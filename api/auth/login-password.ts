import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, addUserToTenant, getTenantFromSlug } from '../db.js'
import crypto from 'crypto'

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
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
      SELECT id, name, email, phone, region, pin, role, password_hash
      FROM users
      WHERE LOWER(email) = ${email.toLowerCase()}
      LIMIT 1
    ` as any[]

    const user = rows[0]
    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const hashed = hashPassword(password)
    if (user.password_hash !== hashed) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const token = generateToken()
    await sql`UPDATE users SET token = ${token} WHERE id = ${user.id}`

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
