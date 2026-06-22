import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, addUserToTenant, getTenantFromSlug } from '../db.js'
import { hashCredential } from '../hash.js'

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = req.body || {}
  const { id, name, email, phone, region, pin, role = 'carer' } = body

  if (!id || !name || !email || !phone || !region || !pin) {
    res.status(400).json({ error: 'id, name, email, phone, region, and pin are required' })
    return
  }

  const token = generateToken()
  const pinHash = await hashCredential(pin)

  try {
    await ensureTables()
    const sql = getSql()
    await sql`
      INSERT INTO users (id, name, email, phone, region, pin, pin_hash, role, token)
      VALUES (${id}, ${name}, ${email.toLowerCase()}, ${phone}, ${region}, ${pin}, ${pinHash}, ${role}, ${token})
    `

    // Auto-link user to the carei tenant so they can access tenant-scoped endpoints
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
      await addUserToTenant(id, careiTenant.id, role)
    }

    res.setHeader('Set-Cookie', `carei_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
    res.status(201).json({
      token,
      user: { id, name, email: email.toLowerCase(), phone, region, role },
    })
  } catch (err: any) {
    if (err.message?.includes('unique constraint') || err.message?.includes('duplicate')) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }
    res.status(500).json({ error: err.message })
  }
}
