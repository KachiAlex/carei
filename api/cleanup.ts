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
  let body = req.body || {}
  if (typeof body === 'string') {
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
        await client.query(`DELETE FROM caregiver_client_assignments WHERE caregiver_id = '${userId}'`)
        await client.query(`DELETE FROM tenant_users WHERE user_id = '${userId}'`)
        await client.query(`DELETE FROM visit_drafts WHERE user_id = '${userId}'`)
        await client.query(`DELETE FROM users WHERE id = '${userId}'`)
        results.userDeleted = true
      }

      if (clientId) {
        await client.query(`DELETE FROM caregiver_client_assignments WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM tasks WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM medication_logs WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM body_map_marks WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM family_messages WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM visit_drafts WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM visits WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM scheduled_visits WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM sos_alerts WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM incidents WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM voice_memos WHERE client_id = '${clientId}'`)
        await client.query(`DELETE FROM clients WHERE id = '${clientId}'`)
        results.clientDeleted = true
      }
    } finally {
      await client.end()
    }

    res.status(200).json({ cleaned: true, results })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}
