import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from './db.js'
import crypto from 'crypto'

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

  // Disabled by default — requires ADMIN_SEED_TOKEN env + matching header.
  // This endpoint creates a full-access account with known credentials,
  // so it must never be reachable unauthenticated.
  const seedToken = process.env.ADMIN_SEED_TOKEN
  if (!seedToken || req.headers['x-admin-seed'] !== seedToken) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()

    const email = 'admin@careiapp.com'
    const password = 'admin123'

    // Remove any existing superadmin accounts
    await sql`DELETE FROM users WHERE role = ${'superadmin'}`

    const existing = await sql`
      SELECT id FROM users WHERE LOWER(email) = ${email.toLowerCase()}
      LIMIT 1
    ` as any[]

    if (existing.length > 0) {
      res.status(200).json({ message: 'Super admin already exists', created: false })
      return
    }

    const id = 'user-superadmin'
    const name = 'Super Admin'
    const phone = '00000000000'
    const region = 'Global'
    const pin = '0000'
    const role = 'superadmin'
    const passwordHash = hashPassword(password)

    await sql`
      INSERT INTO users (id, name, email, phone, region, pin, role, password_hash, email_verified)
      VALUES (${id}, ${name}, ${email}, ${phone}, ${region}, ${pin}, ${role}, ${passwordHash}, TRUE)
    `

    res.status(201).json({
      message: 'Super admin created successfully',
      created: true,
      user: { id, name, email, role },
    })
  } catch (err: any) {
    console.error('[seed-superadmin] error:', err)
    res.status(500).json({ error: err.message })
  }
}
