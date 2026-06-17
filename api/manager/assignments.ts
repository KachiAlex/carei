import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken } from '../db.js'

function generateId(): string {
  return 'a-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

async function getUserFromToken(sql: any, token: string) {
  const rows = await sql`SELECT id, name, role FROM users WHERE token = ${token} LIMIT 1` as any[]
  return rows[0] || null
}

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
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }
    const isManager = user.role === 'manager' || user.role === 'admin'

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT
          a.id,
          a.caregiver_id AS "caregiverId",
          c.name AS "caregiverName",
          a.client_id AS "clientId",
          cl.name AS "clientName",
          a.visit_date AS "visitDate",
          a.visit_time AS "visitTime",
          a.instructions,
          a.assigned_at AS "assignedAt"
        FROM caregiver_client_assignments a
        JOIN users c ON a.caregiver_id = c.id
        JOIN clients cl ON a.client_id = cl.id
        ORDER BY a.assigned_at DESC
      ` as any[]
      res.status(200).json({ assignments: rows })
      return
    }

    if (req.method === 'POST') {
      if (!isManager) {
        res.status(403).json({ error: 'Only managers can create assignments' })
        return
      }
      const { caregiverId, clientId, visitDate, visitTime, instructions } = req.body || {}
      if (!caregiverId || !clientId) {
        res.status(400).json({ error: 'caregiverId and clientId required' })
        return
      }

      await sql`
        INSERT INTO caregiver_client_assignments (id, caregiver_id, client_id, visit_date, visit_time, instructions)
        VALUES (${generateId()}, ${caregiverId}, ${clientId}, ${visitDate || null}, ${visitTime || null}, ${instructions || null})
        ON CONFLICT (caregiver_id, client_id) DO UPDATE SET
          visit_date = EXCLUDED.visit_date,
          visit_time = EXCLUDED.visit_time,
          instructions = EXCLUDED.instructions
      `
      res.status(201).json({ status: 'assigned' })
      return
    }

    if (req.method === 'PATCH') {
      if (!isManager) {
        res.status(403).json({ error: 'Only managers can update assignments' })
        return
      }
      const { id } = req.query as { id?: string }
      if (!id) {
        res.status(400).json({ error: 'id required' })
        return
      }
      const { visitDate, visitTime, instructions } = req.body || {}
      await sql`
        UPDATE caregiver_client_assignments SET
          visit_date = COALESCE(${visitDate || null}, visit_date),
          visit_time = COALESCE(${visitTime || null}, visit_time),
          instructions = COALESCE(${instructions || null}, instructions)
        WHERE id = ${id}
      `
      res.status(200).json({ status: 'updated' })
      return
    }

    if (req.method === 'DELETE') {
      if (!isManager) {
        res.status(403).json({ error: 'Only managers can delete assignments' })
        return
      }
      const { caregiverId, clientId } = req.query as { caregiverId?: string; clientId?: string }
      if (!caregiverId || !clientId) {
        res.status(400).json({ error: 'caregiverId and clientId required' })
        return
      }
      await sql`
        DELETE FROM caregiver_client_assignments
        WHERE caregiver_id = ${caregiverId} AND client_id = ${clientId}
      `
      res.status(200).json({ status: 'unassigned' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
