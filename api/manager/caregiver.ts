import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { id } = req.query
  const caregiverId = Array.isArray(id) ? id[0] : id

  if (!caregiverId) {
    res.status(400).json({ error: 'Caregiver ID required' })
    return
  }

  const tenantSlug = getTenantSlug(req)
  if (!tenantSlug) {
    res.status(400).json({ error: 'Tenant slug required via X-Tenant-Slug header' })
    return
  }

  try {
    await ensureTables()
    await withTenant(req, res, async ({ tenantId, role, sql }) => {
      const isManager = role === 'manager' || role === 'admin'
      if (!isManager) {
        res.status(403).json({ error: 'Only managers can manage caregivers' })
        return
      }

      if (req.method === 'GET') {
        const rows = await sql`SELECT id, name, email, phone, region, role, status, created_at FROM users WHERE id = ${caregiverId} AND tenant_id = ${tenantId} LIMIT 1` as any[]
        if (!rows[0]) {
          res.status(404).json({ error: 'Caregiver not found' })
          return
        }
        res.status(200).json(rows[0])
        return
      }

      if (req.method === 'PATCH') {
        const body = req.body || {}
        const { status } = body
        if (!status) {
          res.status(400).json({ error: 'status is required' })
          return
        }
        await sql`UPDATE users SET status = ${status} WHERE id = ${caregiverId} AND tenant_id = ${tenantId}`
        res.status(200).json({ status: 'updated', id: caregiverId })
        return
      }

      if (req.method === 'DELETE') {
        await sql`DELETE FROM users WHERE id = ${caregiverId} AND tenant_id = ${tenantId}`
        res.status(200).json({ status: 'deleted', id: caregiverId })
        return
      }

      res.status(405).json({ error: 'Method not allowed' })
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
