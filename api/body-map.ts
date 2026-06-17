import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, getAuthToken, withTenant, getTenantSlug } from './db.js'

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
    const sql = getSql()
    const users = await sql`SELECT id, name, role FROM users WHERE token = ${token}`
    if (!users[0]) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }
    const user = users[0] as any

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        if (req.method === 'POST') {
          const { visitId, clientId, x, y, side, type, note, photoUrl } = req.body || {}
          if (!visitId || x == null || y == null) {
            res.status(400).json({ error: 'visitId, x, y required' })
            return
          }

          // Verify the visit belongs to this tenant
          const visitRows = await tenantSql`SELECT id FROM visits WHERE id = ${visitId} AND tenant_id = ${tenantId}`
          if (!visitRows[0]) {
            res.status(403).json({ error: 'Visit not found in this organization' })
            return
          }

          const id = 'bm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
          await tenantSql`
            INSERT INTO body_map_marks (id, visit_id, client_id, carer_id, x, y, side, type, note, photo_url, tenant_id)
            VALUES (${id}, ${visitId}, ${clientId || null}, ${user.id}, ${x}, ${y}, ${side || 'anterior'}, ${type || 'skin_integrity'}, ${note || null}, ${photoUrl || null}, ${tenantId})
          `
          res.status(200).json({ id, status: 'saved' })
          return
        }

        if (req.method === 'GET') {
          const { visitId, clientId } = req.query
          let rows

          if (visitId) {
            // Filter by tenant through visits table join
            rows = await tenantSql`
              SELECT bm.* FROM body_map_marks bm
              JOIN visits v ON bm.visit_id = v.id
              WHERE bm.visit_id = ${visitId} AND v.tenant_id = ${tenantId}
              ORDER BY bm.created_at DESC
            `
          } else if (clientId) {
            // Filter by tenant through clients table
            rows = await tenantSql`
              SELECT bm.* FROM body_map_marks bm
              JOIN clients c ON bm.client_id = c.id
              WHERE bm.client_id = ${clientId} AND c.tenant_id = ${tenantId}
              ORDER BY bm.created_at DESC
            `
          } else {
            // Filter by carer and tenant
            rows = await tenantSql`
              SELECT bm.* FROM body_map_marks bm
              WHERE bm.carer_id = ${user.id} AND bm.tenant_id = ${tenantId}
              ORDER BY bm.created_at DESC
            `
          }
          res.status(200).json(rows)
          return
        }

        if (req.method === 'DELETE') {
          const { markId } = req.query
          if (!markId) {
            res.status(400).json({ error: 'markId required' })
            return
          }
          await tenantSql`DELETE FROM body_map_marks WHERE id = ${markId} AND carer_id = ${user.id} AND tenant_id = ${tenantId}`
          res.status(200).json({ status: 'deleted' })
          return
        }

        res.status(405).json({ error: 'Method not allowed' })
      })
      return
    }

    // Legacy non-tenant handler
    if (req.method === 'POST') {
      const { visitId, clientId, x, y, side, type, note, photoUrl } = req.body || {}
      if (!visitId || x == null || y == null) {
        res.status(400).json({ error: 'visitId, x, y required' })
        return
      }
      const id = 'bm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
      await sql`
        INSERT INTO body_map_marks (id, visit_id, client_id, carer_id, x, y, side, type, note, photo_url)
        VALUES (${id}, ${visitId}, ${clientId || null}, ${user.id}, ${x}, ${y}, ${side || 'anterior'}, ${type || 'skin_integrity'}, ${note || null}, ${photoUrl || null})
      `
      res.status(200).json({ id, status: 'saved' })
      return
    }

    if (req.method === 'GET') {
      const { visitId, clientId } = req.query
      let rows
      if (visitId) {
        rows = await sql`SELECT * FROM body_map_marks WHERE visit_id = ${visitId} ORDER BY created_at DESC`
      } else if (clientId) {
        rows = await sql`SELECT * FROM body_map_marks WHERE client_id = ${clientId} ORDER BY created_at DESC`
      } else {
        rows = await sql`SELECT * FROM body_map_marks WHERE carer_id = ${user.id} ORDER BY created_at DESC`
      }
      res.status(200).json(rows)
      return
    }

    if (req.method === 'DELETE') {
      const { markId } = req.query
      if (!markId) {
        res.status(400).json({ error: 'markId required' })
        return
      }
      await sql`DELETE FROM body_map_marks WHERE id = ${markId} AND carer_id = ${user.id}`
      res.status(200).json({ status: 'deleted' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
