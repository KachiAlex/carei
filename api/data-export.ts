import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getSql,
  setCors,
  ensureTables,
  withTenant,
  getTenantSlug,
  logAuditEvent,
} from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const tenantSlug = getTenantSlug(req)
  if (!tenantSlug) {
    res.status(400).json({ error: 'Tenant slug required via X-Tenant-Slug header' })
    return
  }

  try {
    await ensureTables()

    await withTenant(req, res, async ({ tenantId, userId, role, sql }) => {
      const allowedRoles = ['admin', 'manager']
      if (!allowedRoles.includes(role)) {
        res.status(403).json({ error: 'Only managers or admins can export agency data' })
        return
      }

      // Fetch all tenant-scoped data
      const tables = [
        'clients',
        'users',
        'visits',
        'scheduled_visits',
        'medication_logs',
        'incidents',
        'body_map_marks',
        'voice_memos',
        'sos_alerts',
        'audit_logs',
        'caregiver_client_assignments',
      ]

      const exportData: Record<string, any[]> = {}

      for (const table of tables) {
        try {
          const rows = await sql.query(`SELECT * FROM ${table} WHERE tenant_id = $1`, [tenantId]) as any[]
          exportData[table] = rows
        } catch (err) {
          exportData[table] = []
        }
      }

      // Tenant info
      const tenantRows = await sql`SELECT * FROM tenants WHERE id = ${tenantId}` as any[]
      exportData.tenant_info = tenantRows

      await logAuditEvent({
        userId,
        tenantId,
        action: 'data_export',
        resource: req.url,
        statusCode: 200,
        details: { tables: Object.keys(exportData), recordCount: Object.values(exportData).reduce((a, b) => a + b.length, 0) },
      })

      const filename = `carei-export-${tenantSlug}-${new Date().toISOString().slice(0, 10)}.json`
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.status(200).json({
        exportedAt: new Date().toISOString(),
        tenantId,
        tenantSlug,
        exportedBy: userId,
        data: exportData,
      })
    })
  } catch (err: any) {
    console.error('Data export error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
