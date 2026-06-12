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

    if (req.method === 'POST') {
      const { visitId, clientId, message } = req.body || {}
      if (!message) {
        res.status(400).json({ error: 'message required' })
        return
      }
      const id = 'fm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
      await sql`
        INSERT INTO family_messages (id, visit_id, client_id, sender_name, sender_role, message)
        VALUES (${id}, ${visitId || null}, ${clientId || null}, ${user.name}, ${user.role}, ${message})
      `
      res.status(200).json({ id, status: 'saved' })
      return
    }

    if (req.method === 'GET') {
      const { visitId, clientId } = req.query
      let rows
      if (visitId) {
        rows = await sql`SELECT * FROM family_messages WHERE visit_id = ${visitId} ORDER BY created_at DESC`
      } else if (clientId) {
        rows = await sql`SELECT * FROM family_messages WHERE client_id = ${clientId} ORDER BY created_at DESC`
      } else {
        rows = await sql`SELECT * FROM family_messages ORDER BY created_at DESC LIMIT 50`
      }
      res.status(200).json(rows)
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
