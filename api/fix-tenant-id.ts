import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, getClient } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const client = getClient()
  await client.connect()

  const tables = [
    'clients', 'users', 'visits', 'scheduled_visits', 'sos_alerts',
    'incidents', 'voice_memos', 'caregiver_client_assignments', 'tasks',
    'task_logs', 'medication_logs', 'body_map_marks', 'family_messages',
    'visit_drafts', 'agencies', 'drug_interactions'
  ]

  const results: Record<string, { added: boolean; addError?: string; backfilled: boolean; backfillError?: string; indexed: boolean; indexError?: string }> = {}

  try {
    for (const table of tables) {
      results[table] = { added: false, backfilled: false, indexed: false }
      try {
        await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id TEXT`)
        results[table].added = true
      } catch (err: any) {
        results[table].added = false
        results[table].addError = err.message || String(err)
      }
      try {
        await client.query(`UPDATE ${table} SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL`)
        results[table].backfilled = true
      } catch (err: any) {
        results[table].backfilled = false
        results[table].backfillError = err.message || String(err)
      }
      try {
        await client.query(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`)
        results[table].indexed = true
      } catch (err: any) {
        results[table].indexed = false
        results[table].indexError = err.message || String(err)
      }
    }
  } finally {
    await client.end()
  }

  res.status(200).json({ fixed: true, results })
}
