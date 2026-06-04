import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')
const sql = neon(connectionString)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { from, to } = req.query as { from?: string; to?: string }
    try {
      let rows
      if (from && to) {
        rows = await sql`
          SELECT
            id,
            client_id AS "clientId",
            client_name AS "clientName",
            carer_id AS "carerId",
            carer_name AS "carerName",
            time,
            duration,
            status,
            tasks,
            flags,
            recurring,
            visit_date AS "visitDate"
          FROM scheduled_visits
          WHERE visit_date BETWEEN ${from} AND ${to}
          ORDER BY visit_date, time
        `
      } else {
        rows = await sql`
          SELECT
            id,
            client_id AS "clientId",
            client_name AS "clientName",
            carer_id AS "carerId",
            carer_name AS "carerName",
            time,
            duration,
            status,
            tasks,
            flags,
            recurring,
            visit_date AS "visitDate"
          FROM scheduled_visits
          ORDER BY visit_date DESC, time
          LIMIT 100
        `
      }
      res.status(200).json({ visits: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const { id, clientId, clientName, carerId, carerName, time, duration, tasks, flags, recurring, visitDate } = body
    if (!id || !clientName || !visitDate) {
      res.status(400).json({ error: 'id, clientName, and visitDate required' })
      return
    }
    try {
      await sql`
        INSERT INTO scheduled_visits (
          id, client_id, client_name, carer_id, carer_name,
          time, duration, tasks, flags, recurring, visit_date
        ) VALUES (
          ${id}, ${clientId || null}, ${clientName}, ${carerId || null}, ${carerName || null},
          ${time || null}, ${duration || null}, ${JSON.stringify(tasks || [])}, ${JSON.stringify(flags || [])}, ${recurring || 'none'}, ${visitDate}
        )
      `
      res.status(201).json({ status: 'created', id })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
