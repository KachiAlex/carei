import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db.js'

function generateId(): string {
  return 'tl-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

async function getUserFromToken(sql: any, token: string) {
  const rows = await sql`SELECT id, name, role FROM users WHERE token = ${token} LIMIT 1` as any[]
  return rows[0] || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const cookie = req.headers.cookie || ''
  const match = cookie.match(/carei_token=([^;]+)/)
  const token = match ? match[1] : ''
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    if (req.method === 'POST') {
      const { clientId, taskName, notes } = req.body || {}
      if (!clientId || !taskName) {
        res.status(400).json({ error: 'clientId and taskName required' })
        return
      }

      // Verify assignment
      const assignments = await sql`
        SELECT 1 FROM caregiver_client_assignments
        WHERE caregiver_id = ${user.id} AND client_id = ${clientId}
        LIMIT 1
      ` as any[]
      if (assignments.length === 0) {
        res.status(403).json({ error: 'Not assigned to this client' })
        return
      }

      const id = generateId()
      await sql`
        INSERT INTO task_logs (id, client_id, caregiver_id, task_name, notes, created_at)
        VALUES (${id}, ${clientId}, ${user.id}, ${taskName}, ${notes || null}, NOW())
      `
      res.status(201).json({ status: 'logged', id })
      return
    }

    if (req.method === 'GET') {
      const { clientId } = req.query as { clientId?: string }
      if (!clientId) {
        res.status(400).json({ error: 'clientId required' })
        return
      }

      const rows = await sql`
        SELECT
          id,
          client_id AS "clientId",
          caregiver_id AS "caregiverId",
          task_name AS "taskName",
          start_time AS "startTime",
          complete_time AS "completeTime",
          notes,
          duration_minutes AS "durationMinutes",
          created_at AS "createdAt"
        FROM task_logs
        WHERE client_id = ${clientId}
        ORDER BY created_at DESC
      ` as any[]
      res.status(200).json({ logs: rows })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
