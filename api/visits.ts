import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')
const sql = neon(connectionString)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
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
