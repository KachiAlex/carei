import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken } from '../db.js'

function generateId(): string {
  return 't-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
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
    if (!user || user.role !== 'manager') {
      res.status(403).json({ error: 'Only managers can manage tasks' })
      return
    }

    if (req.method === 'GET') {
      const { clientId } = req.query as { clientId?: string }
      let rows
      if (clientId) {
        rows = await sql`
          SELECT id, client_id AS "clientId", name, description, frequency, created_at AS "createdAt"
          FROM tasks WHERE client_id = ${clientId} ORDER BY name
        ` as any[]
      } else {
        rows = await sql`
          SELECT t.id, t.client_id AS "clientId", t.name, t.description, t.frequency, c.name AS "clientName"
          FROM tasks t
          JOIN clients c ON t.client_id = c.id
          ORDER BY c.name, t.name
        ` as any[]
      }
      res.status(200).json({ tasks: rows })
      return
    }

    if (req.method === 'POST') {
      const { clientId, name, description, frequency = 'daily' } = req.body || {}
      if (!clientId || !name) {
        res.status(400).json({ error: 'clientId and name required' })
        return
      }
      const id = generateId()
      await sql`
        INSERT INTO tasks (id, client_id, name, description, frequency)
        VALUES (${id}, ${clientId}, ${name}, ${description || null}, ${frequency})
      `
      res.status(201).json({ status: 'created', id })
      return
    }

    if (req.method === 'DELETE') {
      const { id } = req.query as { id?: string }
      if (!id) {
        res.status(400).json({ error: 'id required' })
        return
      }
      await sql`DELETE FROM tasks WHERE id = ${id}`
      res.status(200).json({ status: 'deleted' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
