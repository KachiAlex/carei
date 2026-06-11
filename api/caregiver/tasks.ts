import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken } from '../db.js'

async function getUserFromToken(sql: any, token: string) {
  const rows = await sql`SELECT id, name, role FROM users WHERE token = ${token} LIMIT 1` as any[]
  return rows[0] || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
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

    const { clientId } = req.query as { clientId?: string }

    if (clientId) {
      // Verify the caregiver is assigned to this client
      const assignment = await sql`
        SELECT 1 FROM caregiver_client_assignments
        WHERE caregiver_id = ${user.id} AND client_id = ${clientId}
        LIMIT 1
      ` as any[]

      if (assignment.length === 0) {
        res.status(403).json({ error: 'Not assigned to this client' })
        return
      }

      const rows = await sql`
        SELECT id, client_id AS "clientId", name, description, frequency, created_at AS "createdAt"
        FROM tasks WHERE client_id = ${clientId} ORDER BY name
      ` as any[]

      res.status(200).json({ tasks: rows })
      return
    }

    // Return tasks for all assigned clients
    const rows = await sql`
      SELECT t.id, t.client_id AS "clientId", t.name, t.description, t.frequency, c.name AS "clientName"
      FROM tasks t
      JOIN clients c ON t.client_id = c.id
      WHERE c.id IN (
        SELECT client_id FROM caregiver_client_assignments WHERE caregiver_id = ${user.id}
      )
      ORDER BY c.name, t.name
    ` as any[]

    res.status(200).json({ tasks: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
