import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, getSql } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const sql = getSql()
  const tables = [
    'clients', 'users', 'visits', 'scheduled_visits', 'sos_alerts',
    'incidents', 'voice_memos', 'caregiver_client_assignments', 'tasks',
    'task_logs', 'medication_logs', 'body_map_marks', 'family_messages',
    'visit_drafts', 'agencies', 'drug_interactions'
  ]

  const results: Record<string, { added: boolean; addError?: string; backfilled: boolean; backfillError?: string; indexed: boolean; indexError?: string }> = {}

  for (const table of tables) {
    results[table] = { added: false, backfilled: false, indexed: false }
    try {
      // Use tagged template literal (no params) — safer for DDL than function call
      await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id TEXT`)
      results[table].added = true
    } catch (err: any) {
      results[table].added = false
      results[table].addError = err.message || String(err)
    }
    try {
      await sql.query(`UPDATE ${table} SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL`)
      results[table].backfilled = true
    } catch (err: any) {
      results[table].backfilled = false
      results[table].backfillError = err.message || String(err)
    }
    try {
      await sql.query(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`)
      results[table].indexed = true
    } catch (err: any) {
      results[table].indexed = false
      results[table].indexError = err.message || String(err)
    }
  }

  // Also ensure migration 12 is marked as applied so it won't conflict later
  try {
    await sql`
      INSERT INTO _migrations (id, name) VALUES (12, 'ensure_tenant_id_columns_v2')
      ON CONFLICT (id) DO NOTHING
    `
  } catch { /* ignore */ }

  res.status(200).json({ fixed: true, results })
}
