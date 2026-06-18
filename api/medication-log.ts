import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

function generateId(): string {
  return 'ml-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, userId, sql: tenantSql }) => {
        if (req.method === 'POST') {
          const body = req.body || {}
          const { clientId, visitId, medicationName, dose, status, witnessName, reason, notes, administeredAt } = body

          if (!clientId || !medicationName || !status) {
            res.status(400).json({ error: 'clientId, medicationName, and status required' })
            return
          }

          const id = generateId()
          const at = administeredAt ? new Date(administeredAt) : new Date()

          await tenantSql`
            INSERT INTO medication_logs (id, tenant_id, client_id, caregiver_id, visit_id, medication_name, dose, administered_at, status, witness_name, reason, notes)
            VALUES (
              ${id}, ${tenantId}, ${clientId}, ${userId}, ${visitId || null},
              ${medicationName}, ${dose || null}, ${at}, ${status},
              ${witnessName || null}, ${reason || null}, ${notes || null}
            )
          `

          res.status(201).json({ id, status: 'logged' })
          return
        }

        if (req.method === 'GET') {
          const clientId = req.query.clientId as string
          const today = req.query.today as string

          let rows
          if (today === '1' && clientId) {
            rows = await tenantSql`
              SELECT * FROM medication_logs
              WHERE tenant_id = ${tenantId} AND client_id = ${clientId} AND DATE(administered_at) = CURRENT_DATE
            ` as any[]
          } else if (clientId) {
            rows = await tenantSql`
              SELECT * FROM medication_logs
              WHERE tenant_id = ${tenantId} AND client_id = ${clientId}
            ` as any[]
          } else {
            rows = await tenantSql`
              SELECT * FROM medication_logs
              WHERE tenant_id = ${tenantId}
            ` as any[]
          }

          res.status(200).json({ logs: rows })
          return
        }

        res.status(405).json({ error: 'Method not allowed' })
      })
      return
    }

    // Legacy non-tenant handler
    const token = req.headers.authorization?.replace('Bearer ', '') || ''
    const userRows = await sql`SELECT id FROM users WHERE token = ${token} LIMIT 1` as any[]
    const userId = userRows[0]?.id
    if (!userId) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    if (req.method === 'POST') {
      const body = req.body || {}
      const { clientId, visitId, medicationName, dose, status, witnessName, reason, notes, administeredAt } = body

      if (!clientId || !medicationName || !status) {
        res.status(400).json({ error: 'clientId, medicationName, and status required' })
        return
      }

      const id = generateId()
      const at = administeredAt ? new Date(administeredAt) : new Date()

      await sql`
        INSERT INTO medication_logs (id, client_id, caregiver_id, visit_id, medication_name, dose, administered_at, status, witness_name, reason, notes)
        VALUES (
          ${id}, ${clientId}, ${userId}, ${visitId || null},
          ${medicationName}, ${dose || null}, ${at}, ${status},
          ${witnessName || null}, ${reason || null}, ${notes || null}
        )
      `

      res.status(201).json({ id, status: 'logged' })
      return
    }

    if (req.method === 'GET') {
      const clientId = req.query.clientId as string
      const today = req.query.today as string

      let query = sql`SELECT * FROM medication_logs WHERE 1=1`

      if (clientId) {
        query = sql`SELECT * FROM medication_logs WHERE client_id = ${clientId}`
      }

      if (today === '1') {
        query = sql`SELECT * FROM medication_logs WHERE client_id = ${clientId} AND DATE(administered_at) = CURRENT_DATE`
      }

      const rows = await query as any[]
      res.status(200).json({ logs: rows })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
