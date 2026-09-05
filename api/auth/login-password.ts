import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, addUserToTenant, getTenantFromSlug, checkRateLimit } from '../db.js'
import crypto from 'crypto'
import { verifyCredential, generateSecureToken, hashToken } from '../hash.js'

function legacyHashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const limit = checkRateLimit(req, 'login-password', 10, 60000)
  if (!limit.allowed) {
    res.status(429).json({ error: 'Too many login attempts', retryAfter: limit.retryAfter })
    return
  }

  const body = req.body || {}
  const { email, password } = body

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const rows = await sql`
      SELECT id, name, email, phone, region, pin, role, password_hash, password_hash_scrypt
      FROM users
      WHERE LOWER(email) = ${email.toLowerCase()}
      LIMIT 1
    ` as any[]

    const user = rows[0]
    if (!user || (!user.password_hash && !user.password_hash_scrypt)) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    let valid = false
    if (user.password_hash_scrypt) {
      valid = await verifyCredential(password, user.password_hash_scrypt)
    } else if (user.password_hash) {
      // Legacy SHA-256 fallback during transition
      valid = user.password_hash === legacyHashPassword(password)
    }
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const accessToken = generateSecureToken()
    const accessTokenHash = await hashToken(accessToken)
    const accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

    const refreshToken = generateSecureToken()
    const refreshTokenHash = await hashToken(refreshToken)
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

    await sql`UPDATE users SET token_hash = ${accessTokenHash}, token_expires_at = ${accessTokenExpiresAt}, refresh_token_hash = ${refreshTokenHash}, refresh_token_expires_at = ${refreshTokenExpiresAt}, token = NULL WHERE id = ${user.id}`

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

    res.setHeader('Set-Cookie', `carei_token=${accessToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
    res.status(200).json({
      token: accessToken,
      refreshToken,
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
