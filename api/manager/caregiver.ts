import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { id } = req.query
  const caregiverId = Array.isArray(id) ? id[0] : id

  if (!caregiverId) {
    res.status(400).json({ error: 'Caregiver ID required' })
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

    // Verify manager
    const managers = await sql`SELECT id, role FROM users WHERE token = ${token} LIMIT 1` as any[]
    const manager = managers[0]
    if (!manager || manager.role !== 'manager') {
      res.status(403).json({ error: 'Only managers can manage caregivers' })
      return
    }

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, name, email, phone, region, role, status, created_at FROM users WHERE id = ${caregiverId} LIMIT 1` as any[]
      if (!rows[0]) {
        res.status(404).json({ error: 'Caregiver not found' })
        return
      }
      res.status(200).json(rows[0])
      return
    }

    if (req.method === 'PATCH') {
      const body = req.body || {}
      const { status } = body
      if (!status) {
        res.status(400).json({ error: 'status is required' })
        return
      }
      await sql`UPDATE users SET status = ${status} WHERE id = ${caregiverId}`
      res.status(200).json({ status: 'updated', id: caregiverId })
      return
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM users WHERE id = ${caregiverId}`
      res.status(200).json({ status: 'deleted', id: caregiverId })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
