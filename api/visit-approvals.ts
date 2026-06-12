import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, getAuthToken, ensureTables } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const users = await sql`SELECT id, name, role FROM users WHERE token = ${token}`
    if (!users[0]) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }
    const user = users[0] as any

    if (req.method === 'GET') {
      const { status, visitId } = req.query
      if (visitId) {
        const rows = await sql`SELECT * FROM visits WHERE id = ${visitId}`
        res.status(200).json(rows[0] || null)
        return
      }
      let rows
      if (status === 'pending') {
        rows = await sql`SELECT * FROM visits WHERE approval_status = 'pending' AND status = 'completed' ORDER BY submitted_at DESC`
      } else if (status === 'approved') {
        rows = await sql`SELECT * FROM visits WHERE approval_status = 'approved' ORDER BY approved_at DESC LIMIT 50`
      } else if (status === 'released') {
        rows = await sql`SELECT * FROM visits WHERE approval_status = 'released' ORDER BY approved_at DESC LIMIT 50`
      } else {
        rows = await sql`SELECT * FROM visits WHERE status = 'completed' ORDER BY submitted_at DESC LIMIT 100`
      }
      res.status(200).json(rows)
      return
    }

    if (req.method === 'PATCH') {
      const { visitId, approvalStatus, familyRead } = req.body || {}
      if (!visitId) {
        res.status(400).json({ error: 'visitId required' })
        return
      }
      if (approvalStatus) {
        await sql`
          UPDATE visits
          SET approval_status = ${approvalStatus},
              approved_at = CASE WHEN ${approvalStatus} IN ('approved', 'released') THEN NOW() ELSE approved_at END,
              approved_by = CASE WHEN ${approvalStatus} IN ('approved', 'released') THEN ${user.name} ELSE approved_by END
          WHERE id = ${visitId}
        `
      }
      if (familyRead) {
        await sql`UPDATE visits SET family_read_at = NOW() WHERE id = ${visitId}`
      }
      res.status(200).json({ status: 'updated' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
