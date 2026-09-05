import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, ensureTables, getSql, getClient, getAuthToken, getUserFromToken } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const sql = getSql()

  if (req.method === 'POST') {
    const token = getAuthToken(req)
    if (!token) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    const user = await getUserFromToken(sql, token)
    if (!user || user.role !== 'superadmin') {
      res.status(403).json({ error: 'Superadmin access required' })
      return
    }
    try {
      await ensureTables()
      res.status(200).json({ status: 'initialized' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  // GET: diagnostic report (public - read only)
  try {
    const migrations = await sql`SELECT id, name, applied_at FROM _migrations ORDER BY id` as any[]
    const tables = [
      'clients', 'users', 'visits', 'scheduled_visits', 'sos_alerts',
      'incidents', 'voice_memos', 'caregiver_client_assignments', 'tasks',
      'task_logs', 'medication_logs', 'body_map_marks', 'family_messages',
      'visit_drafts', 'agencies', 'drug_interactions'
    ]
    const client = getClient()
    await client.connect()
    const columnCheck: Record<string, boolean> = {}
    try {
      for (const table of tables) {
        try {
          const result = await client.query(
            'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
            [table, 'tenant_id']
          )
          columnCheck[table] = (result.rows as any[]).length > 0
        } catch {
          columnCheck[table] = false
        }
      }
    } finally {
      await client.end()
    }
    res.status(200).json({
      migrations: migrations.map(m => ({ id: m.id, name: m.name, applied_at: m.applied_at })),
      tenant_id_columns: columnCheck,
      all_columns_ok: Object.values(columnCheck).every(Boolean)
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
