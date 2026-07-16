import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getUserFromToken, addUserToTenant, getTenantFromSlug } from '../db.js'
import { generateSecureToken, hashToken } from '../hash.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { email, token } = req.body || {}
  if (!email || !token) {
    res.status(400).json({ error: 'email and token required' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()

    // Validate the token that was stored in the device's biometric secure storage
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired biometric token' })
      return
    }

    // Verify the email matches the token's owner
    const userRows = await sql`
      SELECT id, name, email, phone, region, role, biometrics_enabled
      FROM users
      WHERE id = ${user.id}
      LIMIT 1
    ` as any[]

    const fullUser = userRows[0]
    if (!fullUser) {
      res.status(401).json({ error: 'User not found' })
      return
    }

    if (fullUser.email !== email.toLowerCase()) {
      res.status(403).json({ error: 'Email does not match biometric credential' })
      return
    }

    // Issue a fresh token so the old one from storage doesn't go stale
    const freshToken = generateSecureToken()
    const tokenHash = await hashToken(freshToken)
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await sql`UPDATE users SET token_hash = ${tokenHash}, token_expires_at = ${tokenExpiresAt}, token = NULL WHERE id = ${user.id}`

    // Auto-link orphaned users to carei tenant
    const tenantRows = await sql`
      SELECT 1 FROM tenant_users WHERE user_id = ${user.id} LIMIT 1
    ` as any[]
    if (tenantRows.length === 0) {
      let careiTenant = await getTenantFromSlug('carei')
      if (!careiTenant) {
        const tenantId = 'tenant-carei'
        await sql`
          INSERT INTO tenants (id, slug, name, plan)
          VALUES (${tenantId}, 'carei', 'Carei', 'professional')
          ON CONFLICT (slug) DO NOTHING
        `
        careiTenant = await getTenantFromSlug('carei')
      }
      if (careiTenant) {
        await addUserToTenant(user.id, careiTenant.id, fullUser.role || 'carer')
      }
    }

    res.setHeader('Set-Cookie', `carei_token=${freshToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
    res.status(200).json({
      token: freshToken,
      user: {
        id: fullUser.id,
        name: fullUser.name,
        email: fullUser.email,
        phone: fullUser.phone,
        region: fullUser.region,
        role: fullUser.role,
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
