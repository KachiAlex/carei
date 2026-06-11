import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, getAuthToken } from './db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const sql = getSql()
    const users = await sql`SELECT id, role FROM users WHERE token = ${token}`
    if (!users[0]) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    if (req.method === 'GET') {
      const { id } = req.query
      if (id) {
        const rows = await sql`SELECT * FROM agencies WHERE id = ${id}`
        res.status(200).json(rows[0] || null)
        return
      }
      const rows = await sql`SELECT * FROM agencies ORDER BY name`
      res.status(200).json(rows)
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
