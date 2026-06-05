import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')
const sql = neon(connectionString)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  const visitId = Array.isArray(id) ? id[0] : id

  if (!visitId) {
    res.status(400).json({ error: 'Visit ID required' })
    return
  }

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT data FROM visit_drafts WHERE visit_id = ${visitId}` as any[]
      res.status(200).json(rows[0]?.data || null)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const data = req.body || {}
      await sql`
        INSERT INTO visit_drafts (visit_id, data, updated_at)
        VALUES (${visitId}, ${JSON.stringify(data)}, NOW())
        ON CONFLICT (visit_id) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW()
      `
      res.status(200).json({ status: 'saved' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM visit_drafts WHERE visit_id = ${visitId}`
      res.status(200).json({ status: 'deleted' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
