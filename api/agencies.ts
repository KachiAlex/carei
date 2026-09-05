import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    const sql = getSql()

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        if (req.method === 'GET') {
          const { id } = req.query
          if (id) {
            const rows = await tenantSql`SELECT * FROM agencies WHERE id = ${id} AND tenant_id = ${tenantId}`
            res.status(200).json(rows[0] || null)
            return
          }
          const rows = await tenantSql`SELECT * FROM agencies WHERE tenant_id = ${tenantId} ORDER BY name`
          res.status(200).json(rows)
          return
        }

        res.status(405).json({ error: 'Method not allowed' })
      })
      return
    }

    // Legacy non-tenant handler
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    if (req.method === 'GET') {
      const { id } = req.query
      if (id) {
        const rows = await sql`SELECT * FROM agencies WHERE id = ${id}`
        res.status(200).json(rows[0] || null)
        return
      }
      const rows = await sql`SELECT * FROM agencies ORDER BY name`
      res.status(200).json(rows)
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
