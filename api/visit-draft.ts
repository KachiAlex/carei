import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { visitId } = req.query as { visitId?: string }

  if (!visitId) {
    res.status(400).json({ error: 'Visit ID required' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // If tenant slug provided, verify visit belongs to tenant before reading/writing drafts
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        // Verify the visit exists in this tenant
        const visitRows = await tenantSql`SELECT id FROM visits WHERE id = ${visitId} AND tenant_id = ${tenantId}`
        if (!visitRows[0]) {
          res.status(403).json({ error: 'Visit not found in this organization' })
          return
        }

        if (req.method === 'GET') {
          const rows = await tenantSql`SELECT data FROM visit_drafts WHERE visit_id = ${visitId}` as any[]
          res.status(200).json(rows[0]?.data || null)
          return
        }

        if (req.method === 'POST') {
          const data = req.body || {}
          await tenantSql`
            INSERT INTO visit_drafts (visit_id, data, updated_at)
            VALUES (${visitId}, ${JSON.stringify(data)}, NOW())
            ON CONFLICT (visit_id) DO UPDATE SET
              data = EXCLUDED.data,
              updated_at = NOW()
          `
          res.status(200).json({ status: 'saved' })
          return
        }

        if (req.method === 'DELETE') {
          await tenantSql`DELETE FROM visit_drafts WHERE visit_id = ${visitId}`
          res.status(200).json({ status: 'deleted' })
          return
        }

        res.status(405).json({ error: 'Method not allowed' })
      })
      return
    }

    // Legacy non-tenant handler
    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM visit_drafts WHERE visit_id = ${visitId}` as any[]
      res.status(200).json(rows[0]?.data || null)
      return
    }

    if (req.method === 'POST') {
      const data = req.body || {}
      await sql`
        INSERT INTO visit_drafts (visit_id, data, updated_at)
        VALUES (${visitId}, ${JSON.stringify(data)}, NOW())
        ON CONFLICT (visit_id) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW()
      `
      res.status(200).json({ status: 'saved' })
      return
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM visit_drafts WHERE visit_id = ${visitId}`
      res.status(200).json({ status: 'deleted' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
