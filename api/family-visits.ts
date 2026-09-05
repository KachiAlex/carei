import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { clientId } = req.query as { clientId?: string }
  if (!clientId) {
    res.status(400).json({ error: 'clientId query parameter required' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        const rows = await tenantSql`
          SELECT
            id,
            client_id AS "clientId",
            client_name AS "clientName",
            carer_name AS "carerName",
            submitted_at AS "submittedAt",
            approval_status AS "approvalStatus",
            elapsed,
            notes,
            mood,
            wellbeing_note AS "wellbeingNote",
            meal_status AS "mealStatus",
            fluid_glasses AS "fluidGlasses",
            handover_note AS "handoverNote"
          FROM visits
          WHERE tenant_id = ${tenantId}
            AND client_id = ${clientId}
            AND approval_status IN ('approved', 'released')
          ORDER BY submitted_at DESC
          LIMIT 50
        ` as any[]
        res.status(200).json({ visits: rows })
      })
      return
    }

    // Legacy non-tenant path
    const rows = await sql`
      SELECT
        id,
        client_id AS "clientId",
        client_name AS "clientName",
        carer_name AS "carerName",
        submitted_at AS "submittedAt",
        approval_status AS "approvalStatus",
        elapsed,
        notes,
        mood,
        wellbeing_note AS "wellbeingNote",
        meal_status AS "mealStatus",
        fluid_glasses AS "fluidGlasses",
        handover_note AS "handoverNote"
      FROM visits
      WHERE client_id = ${clientId}
        AND approval_status IN ('approved', 'released')
      ORDER BY submitted_at DESC
      LIMIT 50
    ` as any[]
    res.status(200).json({ visits: rows })
  } catch (err: any) {
    console.error('Family visits error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
