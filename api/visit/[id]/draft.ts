import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors } from '../../../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  const { id } = req.query
  const visitId = Array.isArray(id) ? id[0] : id

  if (!visitId) {
    res.status(400).json({ error: 'Visit ID required' })
    return
  }

  try {
    const sql = getSql()
    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM visit_drafts WHERE visit_id = ${visitId}` as any[]
      res.status(200).json(rows[0]?.data || null)
      return
    }

    if (req.method === 'POST') {
      const data = req.body || {}
      await sql`
        INSERT INTO visit_drafts (visit_id, data, updated_at)
        VALUES (${visitId}, ${JSON.stringify(data)}, NOW())
        ON CONFLICT (visit_id) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW()
      `
      res.status(200).json({ status: 'saved' })
      return
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM visit_drafts WHERE visit_id = ${visitId}`
      res.status(200).json({ status: 'deleted' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
