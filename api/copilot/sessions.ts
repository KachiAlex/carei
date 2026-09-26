import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, getTenantSlug, getTenantFromSlug } from '../db.js'

/**
 * GET /api/copilot/sessions — list the user's copilot sessions (most recent first)
 * GET /api/copilot/sessions?id=... — full session with messages
 * DELETE /api/copilot/sessions?id=... — delete a session
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const sql = getSql()
    const token = getAuthToken(req)
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    const { id } = req.query as { id?: string }

    if (req.method === 'GET') {
      if (id) {
        const rows = await sql`
          SELECT id, title, messages, created_at, updated_at
          FROM assistant_sessions WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
        ` as any[]
        if (!rows[0]) { res.status(404).json({ error: 'Session not found' }); return }
        res.status(200).json({ session: rows[0] })
        return
      }
      const rows = await sql`
        SELECT id, title, created_at, updated_at,
               jsonb_array_length(messages) AS message_count
        FROM assistant_sessions WHERE user_id = ${user.id}
        ORDER BY updated_at DESC LIMIT 50
      ` as any[]
      res.status(200).json({ sessions: rows })
      return
    }

    if (req.method === 'DELETE') {
      if (!id) { res.status(400).json({ error: 'id required' }); return }
      await sql`DELETE FROM assistant_sessions WHERE id = ${id} AND user_id = ${user.id}`
      res.status(200).json({ deleted: true, id })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[copilot/sessions] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
