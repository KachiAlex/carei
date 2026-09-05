import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, getAuthToken, getUserFromToken, ensureTables, withTenant, getTenantSlug } from './db.js'

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
          const { visitId, clientId, message } = req.body || {}
          if (!message) {
            res.status(400).json({ error: 'message required' })
            return
          }

          // Verify visit/client belongs to this tenant
          if (visitId) {
            const visitRows = await tenantSql`SELECT id FROM visits WHERE id = ${visitId} AND tenant_id = ${tenantId}`
            if (!visitRows[0]) {
              res.status(403).json({ error: 'Visit not found in this organization' })
              return
            }
          } else if (clientId) {
            const clientRows = await tenantSql`SELECT id FROM clients WHERE id = ${clientId} AND tenant_id = ${tenantId}`
            if (!clientRows[0]) {
              res.status(403).json({ error: 'Client not found in this organization' })
              return
            }
          }

          const id = 'fm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
          await tenantSql`
            INSERT INTO family_messages (id, visit_id, client_id, sender_name, sender_role, message)
            VALUES (${id}, ${visitId || null}, ${clientId || null}, ${user.name}, ${user.role}, ${message})
          `
          res.status(200).json({ id, status: 'saved' })
          return
        }

        if (req.method === 'GET') {
          const { visitId, clientId } = req.query
          let rows

          if (visitId) {
            // Filter via visits table join
            rows = await tenantSql`
              SELECT fm.* FROM family_messages fm
              JOIN visits v ON fm.visit_id = v.id
              WHERE fm.visit_id = ${visitId} AND v.tenant_id = ${tenantId}
              ORDER BY fm.created_at DESC
            `
          } else if (clientId) {
            // Filter via clients table join
            rows = await tenantSql`
              SELECT fm.* FROM family_messages fm
              JOIN clients c ON fm.client_id = c.id
              WHERE fm.client_id = ${clientId} AND c.tenant_id = ${tenantId}
              ORDER BY fm.created_at DESC
            `
          } else {
            // Get messages for visits in this tenant
            rows = await tenantSql`
              SELECT fm.* FROM family_messages fm
              JOIN visits v ON fm.visit_id = v.id
              WHERE v.tenant_id = ${tenantId}
              ORDER BY fm.created_at DESC
              LIMIT 50
            `
          }
          res.status(200).json(rows)
          return
        }

        res.status(405).json({ error: 'Method not allowed' })
      })
      return
    }

    // Legacy non-tenant handler
    if (req.method === 'POST') {
      const { visitId, clientId, message } = req.body || {}
      if (!message) {
        res.status(400).json({ error: 'message required' })
        return
      }
      const id = 'fm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
      await sql`
        INSERT INTO family_messages (id, visit_id, client_id, sender_name, sender_role, message)
        VALUES (${id}, ${visitId || null}, ${clientId || null}, ${user.name}, ${user.role}, ${message})
      `
      res.status(200).json({ id, status: 'saved' })
      return
    }

    if (req.method === 'GET') {
      const { visitId, clientId } = req.query
      let rows
      if (visitId) {
        rows = await sql`SELECT * FROM family_messages WHERE visit_id = ${visitId} ORDER BY created_at DESC`
      } else if (clientId) {
        rows = await sql`SELECT * FROM family_messages WHERE client_id = ${clientId} ORDER BY created_at DESC`
      } else {
        rows = await sql`SELECT * FROM family_messages ORDER BY created_at DESC LIMIT 50`
      }
      res.status(200).json(rows)
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
