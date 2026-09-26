import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

/**
 * GET /api/security-events — list security events for the tenant.
 * Managers/admins/superadmin only. Events are append-only (written via
 * logSecurityEvent in db.ts); no update/delete endpoints exist.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  try {
    await ensureTables()
    const tenantSlug = getTenantSlug(req)
    if (!tenantSlug) {
      res.status(400).json({ error: 'Tenant slug required (X-Tenant-Slug header)' })
      return
    }

    await withTenant(req, res, async ({ tenantId, role, sql }) => {
      if (role !== 'manager' && role !== 'admin' && role !== 'superadmin') {
        res.status(403).json({ error: 'Managers only' })
        return
      }
      const { eventType, limit } = req.query as { eventType?: string; limit?: string }
      const max = Math.min(parseInt(limit || '100', 10) || 100, 500)

      let rows: any[]
      if (eventType) {
        rows = await sql`
          SELECT id, event_type, actor_id, actor_email, subject_email, device_id, metadata, created_at
          FROM security_events
          WHERE tenant_id = ${tenantId} AND event_type = ${eventType}
          ORDER BY created_at DESC LIMIT ${max}
        ` as any[]
      } else {
        rows = await sql`
          SELECT id, event_type, actor_id, actor_email, subject_email, device_id, metadata, created_at
          FROM security_events
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC LIMIT ${max}
        ` as any[]
      }
      res.status(200).json({ events: rows })
    })
  } catch (err: any) {
    console.error('[security-events] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
