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

  try {
    await ensureTables()
    const sql = getSql()

    // Check if superadmin already exists
    const existing = await sql`
      SELECT id FROM users WHERE LOWER(email) = ${'superadmin@carei.com'}
      LIMIT 1
    ` as any[]

    if (existing.length > 0) {
      res.status(200).json({ message: 'Super admin already exists', created: false })
      return
    }

    const id = 'user-superadmin'
    const name = 'Super Admin'
    const email = 'superadmin@carei.com'
    const phone = '00000000000'
    const region = 'Global'
    const pin = '0000'
    const role = 'superadmin'
    const passwordHash = hashPassword('superadmin123')

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
    res.status(500).json({ error: err.message })
  }
}
