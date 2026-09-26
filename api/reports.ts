import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const sql = getSql()
    const tenantSlug = getTenantSlug(req)

    if (req.method === 'GET') {
      const { id, clientId, reportType } = req.query as { id?: string; clientId?: string; reportType?: string }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, role, sql: ts }) => {
          if (role !== 'manager' && role !== 'admin' && role !== 'superadmin') {
            res.status(403).json({ error: 'Managers only' })
            return
          }
          if (id) {
            const rows = await ts`
              SELECT r.*, c.name AS client_name FROM reports r
              LEFT JOIN clients c ON c.id = r.client_id
              WHERE r.id = ${id} AND r.tenant_id = ${tenantId} LIMIT 1
            ` as any[]
            if (!rows[0]) { res.status(404).json({ error: 'Report not found' }); return }
            res.status(200).json({ report: rows[0] })
            return
          }
          let rows: any[]
          if (clientId) {
            rows = await ts`
              SELECT r.id, r.report_type, r.title, r.client_id, r.visit_id, r.generated_by, r.created_at, c.name AS client_name
              FROM reports r LEFT JOIN clients c ON c.id = r.client_id
              WHERE r.tenant_id = ${tenantId} AND r.client_id = ${clientId}
              ORDER BY r.created_at DESC LIMIT 100
            ` as any[]
          } else if (reportType) {
            rows = await ts`
              SELECT r.id, r.report_type, r.title, r.client_id, r.visit_id, r.generated_by, r.created_at, c.name AS client_name
              FROM reports r LEFT JOIN clients c ON c.id = r.client_id
              WHERE r.tenant_id = ${tenantId} AND r.report_type = ${reportType}
              ORDER BY r.created_at DESC LIMIT 100
            ` as any[]
          } else {
            rows = await ts`
              SELECT r.id, r.report_type, r.title, r.client_id, r.visit_id, r.generated_by, r.created_at, c.name AS client_name
              FROM reports r LEFT JOIN clients c ON c.id = r.client_id
              WHERE r.tenant_id = ${tenantId}
              ORDER BY r.created_at DESC LIMIT 100
            ` as any[]
          }
          res.status(200).json({ reports: rows })
        })
        return
      }

      const token = getAuthToken(req)
      const user = await getUserFromToken(sql, token)
      if (!user) { res.status(401).json({ error: 'Invalid token' }); return }
      if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'superadmin') {
        res.status(403).json({ error: 'Managers only' })
        return
      }
      const rows = await sql`
        SELECT id, report_type, title, client_id, visit_id, generated_by, created_at
        FROM reports ORDER BY created_at DESC LIMIT 100
      ` as any[]
      res.status(200).json({ reports: rows })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[reports] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
