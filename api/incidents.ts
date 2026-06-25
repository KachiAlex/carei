import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, checkRateLimit, withTenant, getTenantSlug } from './db.js'

function generateId(): string {
  return 'inc-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        if (req.method === 'POST') {
          const limit = checkRateLimit(req, 'incidents', 10, 60000)
          if (!limit.allowed) {
            res.status(429).json({ error: 'Too many incident reports', retryAfter: limit.retryAfter })
            return
          }
          const { visitId, clientId, clientName, type, description, severity } = req.body || {}
          if (!type) {
            res.status(400).json({ error: 'type required' })
            return
          }
          const validSeverity = ['low', 'medium', 'high']
          if (severity && !validSeverity.includes(severity)) {
            res.status(400).json({ error: 'severity must be low, medium, or high' })
            return
          }

          // If visitId provided, verify it belongs to this tenant
          if (visitId) {
            const visitRows = await tenantSql`SELECT id FROM visits WHERE id = ${visitId} AND tenant_id = ${tenantId}`
            if (!visitRows[0]) {
              res.status(403).json({ error: 'Visit not found in this organization' })
              return
            }
          }

          const id = generateId()
          await tenantSql`
            INSERT INTO incidents (id, visit_id, carer_id, carer_name, client_id, client_name, type, description, severity, timestamp)
            VALUES (
              ${id}, ${visitId || null}, ${user.id}, ${user.name}, ${clientId || null},
              ${clientName || null}, ${type}, ${description || null}, ${severity || 'medium'}, NOW()
            )
          `
          res.status(201).json({ status: 'logged', id })
          return
        }

        if (req.method === 'GET') {
          const { visitId } = req.query as { visitId?: string }
          if (visitId) {
            // Filter incidents by visit (tenant-scoped via visits join)
            const rows = await tenantSql`
              SELECT i.id, i.visit_id AS "visitId", i.carer_id AS "carerId", i.carer_name AS "carerName",
                     i.client_id AS "clientId", i.client_name AS "clientName", i.type, i.description, i.severity,
                     i.timestamp, i.resolved
              FROM incidents i
              JOIN visits v ON i.visit_id = v.id
              WHERE i.visit_id = ${visitId} AND v.tenant_id = ${tenantId}
              ORDER BY i.timestamp DESC
            ` as any[]
            res.status(200).json({ incidents: rows })
            return
          }

          // Get incidents for user's visits in this tenant
          const rows = await tenantSql`
            SELECT i.id, i.visit_id AS "visitId", i.carer_id AS "carerId", i.carer_name AS "carerName",
                   i.client_id AS "clientId", i.client_name AS "clientName", i.type, i.description, i.severity,
                   i.timestamp, i.resolved
            FROM incidents i
            JOIN visits v ON i.visit_id = v.id
            WHERE i.carer_id = ${user.id} AND v.tenant_id = ${tenantId}
            ORDER BY i.timestamp DESC
            LIMIT 50
          ` as any[]
          res.status(200).json({ incidents: rows })
          return
        }

        res.status(405).json({ error: 'Method not allowed' })
      })
      return
    }

    // Legacy non-tenant handler
    if (req.method === 'POST') {
      const limit = checkRateLimit(req, 'incidents', 10, 60000)
      if (!limit.allowed) {
        res.status(429).json({ error: 'Too many incident reports', retryAfter: limit.retryAfter })
        return
      }
      const { visitId, clientId, clientName, type, description, severity } = req.body || {}
      if (!type) {
        res.status(400).json({ error: 'type required' })
        return
      }
      const validSeverity = ['low', 'medium', 'high']
      if (severity && !validSeverity.includes(severity)) {
        res.status(400).json({ error: 'severity must be low, medium, or high' })
        return
      }

      const id = generateId()
      await sql`
        INSERT INTO incidents (id, visit_id, carer_id, carer_name, client_id, client_name, type, description, severity, timestamp)
        VALUES (
          ${id}, ${visitId || null}, ${user.id}, ${user.name}, ${clientId || null},
          ${clientName || null}, ${type}, ${description || null}, ${severity || 'medium'}, NOW()
        )
      `
      res.status(201).json({ status: 'logged', id })
      return
    }

    if (req.method === 'GET') {
      const { visitId } = req.query as { visitId?: string }
      if (visitId) {
        const rows = await sql`
          SELECT id, visit_id AS "visitId", carer_id AS "carerId", carer_name AS "carerName",
                 client_id AS "clientId", client_name AS "clientName", type, description, severity,
                 timestamp, resolved
          FROM incidents
          WHERE visit_id = ${visitId}
          ORDER BY timestamp DESC
        ` as any[]
        res.status(200).json({ incidents: rows })
        return
      }

      const rows = await sql`
        SELECT id, visit_id AS "visitId", carer_id AS "carerId", carer_name AS "carerName",
               client_id AS "clientId", client_name AS "clientName", type, description, severity,
               timestamp, resolved
        FROM incidents
        WHERE carer_id = ${user.id}
        ORDER BY timestamp DESC
        LIMIT 50
      ` as any[]
      res.status(200).json({ incidents: rows })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
