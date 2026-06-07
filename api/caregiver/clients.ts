import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db.js'

async function getUserFromToken(sql: any, token: string) {
  const rows = await sql`SELECT id, name, role FROM users WHERE token = ${token} LIMIT 1` as any[]
  return rows[0] || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
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

  try {
    await ensureTables()
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    const rows = await sql`
      SELECT
        c.id,
        c.name,
        c.age,
        c.address,
        c.conditions,
        c.medications,
        c.preferences,
        c.emergency_contact AS "emergencyContact",
        a.assigned_at AS "assignedAt"
      FROM caregiver_client_assignments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.caregiver_id = ${user.id}
      ORDER BY c.name
    ` as any[]

    res.status(200).json({ clients: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
