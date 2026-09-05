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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const tenantSlug = getTenantSlug(req)
  if (!tenantSlug) {
    res.status(400).json({ error: 'Tenant slug required via X-Tenant-Slug header' })
    return
  }

  const { confirmText } = req.body || {}
  if (confirmText !== 'DELETE ALL DATA') {
    res.status(400).json({ error: 'Confirmation required. Send confirmText: "DELETE ALL DATA"' })
    return
  }

  try {
    await ensureTables()

    await withTenant(req, res, async ({ tenantId, userId, role, sql }) => {
      const allowedRoles = ['admin', 'manager']
      if (!allowedRoles.includes(role)) {
        res.status(403).json({ error: 'Only managers or admins can delete agency data' })
        return
      }

      const tables = [
        'voice_memos',
        'body_map_marks',
        'incidents',
        'medication_logs',
        'visits',
        'scheduled_visits',
        'caregiver_client_assignments',
        'tenant_users',
        'clients',
        'audit_logs',
      ]

      let totalDeleted = 0
      for (const table of tables) {
        try {
          const result = await sql.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]) as any
          totalDeleted += result?.rowCount || 0
        } catch (err) {
          console.error(`Failed to delete from ${table}:`, err)
        }
      }

      // Delete users (carers) associated with this tenant, but not the manager/admin themselves
      try {
        const caregiverResult = await sql`
          DELETE FROM users
          WHERE tenant_id = ${tenantId}
            AND role = 'carer'
        `
        totalDeleted += (caregiverResult as any)?.rowCount || 0
      } catch (err) {
        console.error('Failed to delete caregivers:', err)
      }

      await logAuditEvent({
        userId,
        tenantId,
        action: 'data_delete',
        resource: req.url,
        statusCode: 200,
        details: { tablesDeleted: tables.length, totalDeleted, confirmText },
      })

      res.status(200).json({
        success: true,
        message: 'Agency data deleted. The agency record itself remains for audit purposes.',
        totalDeleted,
      })
    })
  } catch (err: any) {
    console.error('Data delete error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
