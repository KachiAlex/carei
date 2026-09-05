import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getUserFromToken, addUserToTenant, getTenantFromSlug } from '../db.js'
import { generateSecureToken, hashToken, verifyToken } from '../hash.js'

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

    // The token from biometric storage is a refresh token.
    // Try refresh token first, then fall back to access token for backward compat.
    let matchedUser: any = null

    // Try refresh token hash
    const refreshUsers = await sql`
      SELECT id, name, email, phone, region, role, biometrics_enabled, refresh_token_hash, refresh_token_expires_at
      FROM users
      WHERE refresh_token_hash IS NOT NULL
    ` as any[]

    for (const u of refreshUsers) {
      const valid = await verifyToken(token, u.refresh_token_hash)
      if (valid) {
        if (u.refresh_token_expires_at && new Date(u.refresh_token_expires_at) < new Date()) {
          continue
        }
        matchedUser = u
        break
      }
    }

    // Fallback: try as access token (backward compat with old biometric storage)
    if (!matchedUser) {
      const user = await getUserFromToken(sql, token)
      if (user) {
        const userRows = await sql`
          SELECT id, name, email, phone, region, role, biometrics_enabled
          FROM users
          WHERE id = ${user.id}
          LIMIT 1
        ` as any[]
        matchedUser = userRows[0] || null
      }
    }

    if (!matchedUser) {
      res.status(401).json({ error: 'Invalid or expired biometric token' })
      return
    }

    if (matchedUser.email !== email.toLowerCase()) {
      res.status(403).json({ error: 'Email does not match biometric credential' })
      return
    }

    // Issue fresh access + refresh tokens (rotate)
    const accessToken = generateSecureToken()
    const accessTokenHash = await hashToken(accessToken)
    const accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const newRefreshToken = generateSecureToken()
    const newRefreshTokenHash = await hashToken(newRefreshToken)
    const newRefreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await sql`UPDATE users SET token_hash = ${accessTokenHash}, token_expires_at = ${accessTokenExpiresAt}, refresh_token_hash = ${newRefreshTokenHash}, refresh_token_expires_at = ${newRefreshTokenExpiresAt}, token = NULL WHERE id = ${matchedUser.id}`

    // Auto-link orphaned users to carei tenant
    const tenantRows = await sql`
      SELECT 1 FROM tenant_users WHERE user_id = ${matchedUser.id} LIMIT 1
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
        await addUserToTenant(matchedUser.id, careiTenant.id, matchedUser.role || 'carer')
      }
    }

    res.setHeader('Set-Cookie', `carei_token=${accessToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
    res.status(200).json({
      token: accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        phone: matchedUser.phone,
        region: matchedUser.region,
        role: matchedUser.role,
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
