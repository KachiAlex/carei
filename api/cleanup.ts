import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, getSql, getClient } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const sql = getSql()
  let body: any = req.body || {}
  if (Buffer.isBuffer(body)) {
    try { body = JSON.parse(body.toString()) } catch { body = {} }
  } else if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  const email = (body.email || '').toLowerCase().trim()
  const clientName = (body.clientName || '').trim()

  if (!email && !clientName) {
    res.status(400).json({ error: 'Provide email or clientName' })
    return
  }

  const results: Record<string, any> = {}

  try {
    // ── Find user ──
    let userId: string | null = null
    if (email) {
      const userRows = await sql`SELECT id FROM users WHERE LOWER(email) = ${email} LIMIT 1` as any[]
      userId = userRows[0]?.id || null
      results.userFound = !!userId
      results.userId = userId
    }

    // ── Find client ──
    let clientId: string | null = null
    if (clientName) {
      const clientRows = await sql`SELECT id FROM clients WHERE name ILIKE ${clientName} LIMIT 1` as any[]
      clientId = clientRows[0]?.id || null
      results.clientFound = !!clientId
      results.clientId = clientId
    }

    // ── Delete related records ──
    const client = getClient()
    await client.connect()
    try {
      if (userId) {
        try { await client.query(`DELETE FROM caregiver_client_assignments WHERE caregiver_id = '${userId}'`) } catch (e: any) { results.userErrors = [...(results.userErrors || []), `assignments: ${e.message}`] }
        try { await client.query(`DELETE FROM tenant_users WHERE user_id = '${userId}'`) } catch (e: any) { results.userErrors = [...(results.userErrors || []), `tenant_users: ${e.message}`] }
        try { await client.query(`DELETE FROM visit_drafts WHERE user_id = '${userId}'`) } catch (e: any) { results.userErrors = [...(results.userErrors || []), `visit_drafts: ${e.message}`] }
        try { await client.query(`DELETE FROM users WHERE id = '${userId}'`) } catch (e: any) { results.userErrors = [...(results.userErrors || []), `users: ${e.message}`] }
        results.userDeleted = !results.userErrors
      }

      if (clientId) {
        try { await client.query(`DELETE FROM caregiver_client_assignments WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `assignments: ${e.message}`] }
        try { await client.query(`DELETE FROM tasks WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `tasks: ${e.message}`] }
        try { await client.query(`DELETE FROM medication_logs WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `medication_logs: ${e.message}`] }
        try { await client.query(`DELETE FROM body_map_marks WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `body_map_marks: ${e.message}`] }
        try { await client.query(`DELETE FROM family_messages WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `family_messages: ${e.message}`] }
        try { await client.query(`DELETE FROM visit_drafts WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `visit_drafts: ${e.message}`] }
        try { await client.query(`DELETE FROM visits WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `visits: ${e.message}`] }
        try { await client.query(`DELETE FROM scheduled_visits WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `scheduled_visits: ${e.message}`] }
        try { await client.query(`DELETE FROM sos_alerts WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `sos_alerts: ${e.message}`] }
        try { await client.query(`DELETE FROM incidents WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `incidents: ${e.message}`] }
        try { await client.query(`DELETE FROM voice_memos WHERE client_id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `voice_memos: ${e.message}`] }
        try { await client.query(`DELETE FROM clients WHERE id = '${clientId}'`) } catch (e: any) { results.clientErrors = [...(results.clientErrors || []), `clients: ${e.message}`] }
        results.clientDeleted = !results.clientErrors
      }
    } finally {
      await client.end()
    }

    res.status(200).json({ cleaned: true, results })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}
