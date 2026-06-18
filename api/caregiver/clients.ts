import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, userId, sql: tenantSql }) => {
        const rows = await tenantSql`
          SELECT
            c.id,
            c.name,
            c.age,
            c.address,
            c.conditions,
            c.medications,
            c.preferences,
            c.emergency_contact AS "emergencyContact",
            a.assigned_at AS "assignedAt"
          FROM caregiver_client_assignments a
          JOIN clients c ON a.client_id = c.id AND c.tenant_id = ${tenantId}
          WHERE a.caregiver_id = ${userId}
            AND a.tenant_id = ${tenantId}
          ORDER BY c.name
        ` as any[]
        res.status(200).json({ clients: rows })
      })
      return
    }

    // Legacy non-tenant handler
    const token = req.headers.authorization?.replace('Bearer ', '') || ''
    const userRows = await sql`SELECT id FROM users WHERE token = ${token} LIMIT 1` as any[]
    const userId = userRows[0]?.id
    if (!userId) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    const rows = await sql`
      SELECT
        c.id,
        c.name,
        c.age,
        c.address,
        c.conditions,
        c.medications,
        c.preferences,
        c.emergency_contact AS "emergencyContact",
        a.assigned_at AS "assignedAt"
      FROM caregiver_client_assignments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.caregiver_id = ${userId}
      ORDER BY c.name
    ` as any[]

    res.status(200).json({ clients: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
