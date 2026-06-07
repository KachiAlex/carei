import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db.js'

function generateId(): string {
  return 'cg-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const cookie = req.headers.cookie || ''
  const match = cookie.match(/carei_token=([^;]+)/)
  const token = match ? match[1] : ''
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const body = req.body || {}
  const { name, email, phone, region, pin, role = 'carer' } = body
  if (!name || !email || !phone || !region || !pin) {
    res.status(400).json({ error: 'name, email, phone, region, and pin are required' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()

    // Verify manager
    const managers = await sql`SELECT id, role FROM users WHERE token = ${token} LIMIT 1` as any[]
    const manager = managers[0]
    if (!manager || manager.role !== 'manager') {
      res.status(403).json({ error: 'Only managers can create caregivers' })
      return
    }

    const id = generateId()
    const caregiverToken = generateToken()

    await sql`
      INSERT INTO users (id, name, email, phone, region, pin, role, token)
      VALUES (${id}, ${name}, ${email.toLowerCase()}, ${phone}, ${region}, ${pin}, ${role}, ${caregiverToken})
    `

    res.status(201).json({
      status: 'created',
      caregiver: { id, name, email: email.toLowerCase(), phone, region, role },
    })
  } catch (err: any) {
    if (err.message?.includes('unique constraint') || err.message?.includes('duplicate')) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }
    res.status(500).json({ error: err.message })
  }
}
