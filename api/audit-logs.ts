import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getSql,
  setCors,
  ensureTables,
  getAuthToken,
  getTenantFromSlug,
  verifyTenantAccess,
  getTenantSlug,
} from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  let userId: string
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    userId = payload.userId
    if (!userId) throw new Error()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  const tenantSlug = getTenantSlug(req)
  if (!tenantSlug) {
    res.status(400).json({ error: 'Tenant slug required via X-Tenant-Slug header' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()

    const tenant = await getTenantFromSlug(tenantSlug)
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' })
      return
    }

    const access = await verifyTenantAccess(userId, tenant.id)
    if (!access.hasAccess || access.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can view audit logs' })
      return
    }

    const limit = Math.min(parseInt(req.query?.limit as string) || 50, 200)
    const action = req.query?.action as string | undefined

    let rows: any[]
    if (action) {
      rows = await sql`
        SELECT * FROM audit_logs
        WHERE tenant_id = ${tenant.id} AND action = ${action}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else {
      rows = await sql`
        SELECT * FROM audit_logs
        WHERE tenant_id = ${tenant.id}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }

    res.status(200).json({
      logs: (rows as any[]).map((r) => ({
        id: r.id,
        userId: r.user_id,
        tenantId: r.tenant_id,
        action: r.action,
        resource: r.resource,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        statusCode: r.status_code,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
        createdAt: r.created_at,
      })),
    })
  } catch (err: any) {
    console.error('Audit logs API error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
