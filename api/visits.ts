import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from './_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const rows = await sql`
      SELECT
        id,
        client_id AS "clientId",
        client_name AS "clientName",
        time,
        duration,
        status,
        tasks,
        flags
      FROM scheduled_visits
      WHERE visit_date = CURRENT_DATE
      ORDER BY time
    `
    res.status(200).json({ visits: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
