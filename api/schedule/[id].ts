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

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const body = req.body || {}
    const { clientId, clientName, carerId, carerName, time, duration, status, tasks, flags, recurring, visitDate } = body
    try {
      await sql`
        UPDATE scheduled_visits SET
          client_id = COALESCE(${clientId || null}, client_id),
          client_name = COALESCE(${clientName || null}, client_name),
          carer_id = COALESCE(${carerId || null}, carer_id),
          carer_name = COALESCE(${carerName || null}, carer_name),
          time = COALESCE(${time || null}, time),
          duration = COALESCE(${duration || null}, duration),
          status = COALESCE(${status || null}, status),
          tasks = COALESCE(${JSON.stringify(tasks || null)}, tasks),
          flags = COALESCE(${JSON.stringify(flags || null)}, flags),
          recurring = COALESCE(${recurring || null}, recurring),
          visit_date = COALESCE(${visitDate || null}, visit_date)
        WHERE id = ${visitId}
      `
      res.status(200).json({ status: 'updated', id: visitId })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM scheduled_visits WHERE id = ${visitId}`
      res.status(200).json({ status: 'deleted', id: visitId })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
