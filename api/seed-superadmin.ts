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

    const email = 'superadmin@careiapp.com'
    const password = 'superadmin123'

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
