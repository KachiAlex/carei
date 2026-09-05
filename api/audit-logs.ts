import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getSql,
  setCors,
  ensureTables,
  getAuthToken,
  getTenantFromSlug,
  verifyTenantAccess,
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
    const allowedRoles = ['admin', 'manager']
    if (!access.hasAccess || !allowedRoles.includes(access.role)) {
      res.status(403).json({ error: 'Only admins or managers can view audit logs' })
      return
    }

    const limit = Math.min(parseInt(req.query?.limit as string) || 50, 500)
    const action = req.query?.action as string | undefined
    const from = req.query?.from as string | undefined
    const to = req.query?.to as string | undefined
    const format = (req.query?.format as string | undefined) || 'json'

    let fromDate: Date | undefined
    let toDate: Date | undefined
    if (from) {
      const d = new Date(from)
      if (!isNaN(d.getTime())) fromDate = d
    }
    if (to) {
      const d = new Date(to)
      if (!isNaN(d.getTime())) toDate = d
    }

    let rows: any[]
    if (action) {
      if (fromDate && toDate) {
        rows = await sql`
          SELECT * FROM audit_logs
          WHERE tenant_id = ${tenant.id} AND action = ${action}
            AND created_at >= ${fromDate.toISOString()} AND created_at <= ${toDate.toISOString()}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else {
        rows = await sql`
          SELECT * FROM audit_logs
          WHERE tenant_id = ${tenant.id} AND action = ${action}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      }
    } else if (fromDate && toDate) {
      rows = await sql`
        SELECT * FROM audit_logs
        WHERE tenant_id = ${tenant.id}
          AND created_at >= ${fromDate.toISOString()} AND created_at <= ${toDate.toISOString()}
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

    const mapped = (rows as any[]).map((r) => ({
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
    }))

    await logAuditEvent({
      userId,
      tenantId: tenant.id,
      action: 'audit_logs_export',
      resource: req.url,
      ipAddress: (req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress) as string | undefined,
      statusCode: 200,
      details: { format, limit: mapped.length, from, to },
    })

    if (format === 'csv') {
      const lines = [
        'id,userId,tenantId,action,resource,ipAddress,userAgent,statusCode,details,createdAt'
      ]
      for (const r of mapped) {
        const details = r.details ? JSON.stringify(r.details).replace(/"/g, '""') : ''
        lines.push(
          `"${r.id}","${r.userId}","${r.tenantId}","${r.action}","${(r.resource || '').replace(/"/g, '""')}","${(r.ipAddress || '')}","${(r.userAgent || '').replace(/"/g, '""')}",${r.statusCode || ''},"${details}","${r.createdAt}"`
        )
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="audit-${tenant.slug}-${new Date().toISOString().slice(0,10)}.csv"`)
      res.status(200).send(lines.join('\n'))
      return
    }

    res.status(200).json({ logs: mapped })
  } catch (err: any) {
    console.error('Audit logs API error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
