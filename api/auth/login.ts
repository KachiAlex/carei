import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, addUserToTenant, getTenantFromSlug, checkRateLimit } from '../db.js'
import { verifyCredential, generateSecureToken, hashToken } from '../hash.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const limit = checkRateLimit(req, 'login-pin', 10, 60000)
  if (!limit.allowed) {
    res.status(429).json({ error: 'Too many login attempts', retryAfter: limit.retryAfter })
    return
  }

  const body = req.body || {}
  const { email, pin } = body

  if (!email || !pin) {
    res.status(400).json({ error: 'email and pin are required' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const rows = await sql`
      SELECT id, name, email, phone, region, pin, pin_hash, role
      FROM users
      WHERE LOWER(email) = ${email.toLowerCase()}
      LIMIT 1
    ` as any[]

    const user = rows[0]
    let pinValid = false
    if (user?.pin_hash) {
      pinValid = await verifyCredential(pin, user.pin_hash)
    } else if (user?.pin) {
      // Fallback to plaintext during transition (migration 18 will backfill)
      pinValid = user.pin === pin
    }
    if (!user || !pinValid) {
      res.status(401).json({ error: 'Invalid email or PIN' })
      return
    }

    const token = generateSecureToken()
    const tokenHash = await hashToken(token)
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    await sql`UPDATE users SET token_hash = ${tokenHash}, token_expires_at = ${tokenExpiresAt}, token = NULL WHERE id = ${user.id}`

    // Auto-link orphaned users to carei tenant so they can access tenant-scoped endpoints
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
        await addUserToTenant(user.id, careiTenant.id, user.role || 'carer')
      }
    }

    res.setHeader('Set-Cookie', `carei_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        region: user.region,
        role: user.role,
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
