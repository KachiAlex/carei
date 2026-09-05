import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, addUserToTenant, getTenantFromSlug } from '../db.js'
import { generateSecureToken, hashToken, verifyToken } from '../hash.js'

const ACCESS_TOKEN_TTL = 15 * 60 * 1000 // 15 minutes
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { refreshToken } = req.body || {}
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken required' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()

    // Find user by refresh token hash
    const users = await sql`
      SELECT id, name, email, phone, region, role, refresh_token_hash, refresh_token_expires_at
      FROM users
      WHERE refresh_token_hash IS NOT NULL
    ` as any[]

    let matchedUser: any = null
    for (const u of users) {
      const valid = await verifyToken(refreshToken, u.refresh_token_hash)
      if (valid) {
        if (u.refresh_token_expires_at && new Date(u.refresh_token_expires_at) < new Date()) {
          continue // expired
        }
        matchedUser = u
        break
      }
    }

    if (!matchedUser) {
      res.status(401).json({ error: 'Invalid or expired refresh token' })
      return
    }

    // Rotate: generate new access + refresh tokens, invalidate old refresh token
    const accessToken = generateSecureToken()
    const accessTokenHash = await hashToken(accessToken)
    const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL).toISOString()

    const newRefreshToken = generateSecureToken()
    const newRefreshTokenHash = await hashToken(newRefreshToken)
    const newRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL).toISOString()

    await sql`
      UPDATE users
      SET token_hash = ${accessTokenHash},
          token_expires_at = ${accessTokenExpiresAt},
          refresh_token_hash = ${newRefreshTokenHash},
          refresh_token_expires_at = ${newRefreshTokenExpiresAt},
          token = NULL
      WHERE id = ${matchedUser.id}
    `

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
    console.error('[auth/refresh] error:', err)
    res.status(500).json({ error: err.message || 'Token refresh failed' })
  }
}
