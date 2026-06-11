import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken } from './db.js'

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

    // 1. Scheduled visits for this carer today
    const scheduled = await sql`
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
      WHERE visit_date = CURRENT_DATE AND carer_id = ${user.id}
      ORDER BY time
    ` as any[]

    // 2. Manager-created assignments for this carer today
    const assignments = await sql`
      SELECT
        a.id,
        c.id AS "clientId",
        c.name AS "clientName",
        a.visit_time AS time,
        '60' AS duration,
        'pending' AS status,
        ARRAY[
          COALESCE(a.instructions, 'Follow care plan'),
          'Assigned by manager'
        ] AS tasks,
        COALESCE(c.conditions, '[]'::jsonb) AS flags
      FROM caregiver_client_assignments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.caregiver_id = ${user.id} AND a.visit_date = CURRENT_DATE
      ORDER BY a.visit_time
    ` as any[]

    // Merge: prefer scheduled visits if same client+time exists, otherwise add assignments
    const scheduledKeys = new Set(scheduled.map((v: any) => `${v.clientId}-${v.time}`))
    const merged = [
      ...scheduled,
      ...assignments.filter((a: any) => !scheduledKeys.has(`${a.clientId}-${a.time}`)),
    ]

    res.status(200).json({ visits: merged })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
