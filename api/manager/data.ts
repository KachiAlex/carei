import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from '../db.js'

async function safeQuery(sql: any, query: any, fallback: any[] = []) {
  try {
    return await query
  } catch (err: any) {
    if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
      return fallback
    }
    throw err
  }
}

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
    await withTenant(req, res, async ({ tenantId, sql }) => {
      const caregiverRows = await sql`SELECT id, name, email, phone, region, role, status, created_at FROM users WHERE role = 'carer' AND tenant_id = ${tenantId} ORDER BY name` as any[]
      const carers = caregiverRows.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        avatar: u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        status: u.status || 'active',
        location: u.region || '—',
        client: '—',
        since: u.created_at ? new Date(u.created_at).toLocaleDateString() : '—',
      }))
      const visits = await safeQuery(sql, sql`SELECT * FROM visits WHERE tenant_id = ${tenantId} ORDER BY submitted_at DESC LIMIT 50`)
      const alerts = await safeQuery(sql, sql`SELECT * FROM sos_alerts WHERE tenant_id = ${tenantId} AND resolved = FALSE ORDER BY timestamp DESC LIMIT 20`)
      const incidents = await safeQuery(sql, sql`SELECT * FROM incidents WHERE tenant_id = ${tenantId} AND resolved = FALSE ORDER BY timestamp DESC LIMIT 50`)
      const medications = await safeQuery(sql, sql`SELECT * FROM medication_logs WHERE tenant_id = ${tenantId} AND DATE(administered_at) = CURRENT_DATE ORDER BY administered_at DESC LIMIT 100`)

      res.status(200).json({
        carers,
        visits,
        alerts,
        incidents,
        medications,
      })
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
