import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from './db.js'

function generateId(): string {
  return 'oi-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()
    const token = getAuthToken(req)
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        // GET: retrieve outcome indicators for a client or visit
        if (req.method === 'GET') {
          const { clientId, visitId } = req.query as { clientId?: string; visitId?: string }

          if (visitId) {
            const rows = await tenantSql`
              SELECT * FROM outcome_indicators
              WHERE visit_id = ${visitId} AND tenant_id = ${tenantId}
              ORDER BY recorded_at DESC
            ` as any[]
            res.status(200).json({ indicators: rows })
            return
          }

          if (clientId) {
            const rows = await tenantSql`
              SELECT oi.*, v.clock_in_at, v.client_name
              FROM outcome_indicators oi
              LEFT JOIN visits v ON v.id = oi.visit_id
              WHERE oi.client_id = ${clientId} AND oi.tenant_id = ${tenantId}
              ORDER BY oi.recorded_at DESC
              LIMIT 100
            ` as any[]
            res.status(200).json({ indicators: rows })
            return
          }

          res.status(400).json({ error: 'clientId or visitId is required' })
          return
        }

        // POST: record outcome indicators for a visit
        if (req.method === 'POST') {
          const {
            visitId, clientId,
            mobilityScore, wellbeingScale, painLevel,
            goalAttainment, behaviourFlags,
            independenceLevel, skinIntegrity, nutritionRisk,
            hydrationRisk, cognitionLevel, notes,
          } = req.body || {}

          if (!visitId && !clientId) {
            res.status(400).json({ error: 'visitId or clientId is required' })
            return
          }

          // Validate scores are 1-5 where applicable
          const validateScore = (v: any) => v === null || v === undefined || (typeof v === 'number' && v >= 1 && v <= 5)
          if (!validateScore(mobilityScore) || !validateScore(wellbeingScale) || !validateScore(painLevel) || !validateScore(independenceLevel) || !validateScore(skinIntegrity) || !validateScore(nutritionRisk) || !validateScore(hydrationRisk) || !validateScore(cognitionLevel)) {
            res.status(400).json({ error: 'Scores must be between 1 and 5' })
            return
          }

          const id = generateId()
          await tenantSql`
            INSERT INTO outcome_indicators (
              id, visit_id, client_id, tenant_id, recorded_by,
              mobility_score, wellbeing_scale, pain_level,
              goal_attainment, behaviour_flags,
              independence_level, skin_integrity, nutrition_risk,
              hydration_risk, cognition_level, notes
            ) VALUES (
              ${id}, ${visitId || null}, ${clientId}, ${tenantId}, ${user.id},
              ${mobilityScore || null}, ${wellbeingScale || null}, ${painLevel || null},
              ${goalAttainment ? JSON.stringify(goalAttainment) : null},
              ${behaviourFlags ? JSON.stringify(behaviourFlags) : null},
              ${independenceLevel || null}, ${skinIntegrity || null}, ${nutritionRisk || null},
              ${hydrationRisk || null}, ${cognitionLevel || null}, ${notes || null}
            )
          `

          res.status(201).json({ id, recorded: true })
          return
        }

        res.status(405).json({ error: 'Method not allowed' })
      })
      return
    }

    // Legacy non-tenant
    if (req.method === 'GET') {
      const { clientId, visitId } = req.query as { clientId?: string; visitId?: string }
      if (visitId) {
        const rows = await sql`SELECT * FROM outcome_indicators WHERE visit_id = ${visitId} ORDER BY recorded_at DESC` as any[]
        res.status(200).json({ indicators: rows })
        return
      }
      if (clientId) {
        const rows = await sql`SELECT * FROM outcome_indicators WHERE client_id = ${clientId} ORDER BY recorded_at DESC LIMIT 100` as any[]
        res.status(200).json({ indicators: rows })
        return
      }
      res.status(400).json({ error: 'clientId or visitId is required' })
      return
    }

    if (req.method === 'POST') {
      const {
        visitId, clientId,
        mobilityScore, wellbeingScale, painLevel,
        goalAttainment, behaviourFlags,
        independenceLevel, skinIntegrity, nutritionRisk,
        hydrationRisk, cognitionLevel, notes,
      } = req.body || {}

      if (!visitId && !clientId) {
        res.status(400).json({ error: 'visitId or clientId is required' })
        return
      }

      const id = generateId()
      await sql`
        INSERT INTO outcome_indicators (
          id, visit_id, client_id, recorded_by,
          mobility_score, wellbeing_scale, pain_level,
          goal_attainment, behaviour_flags,
          independence_level, skin_integrity, nutrition_risk,
          hydration_risk, cognition_level, notes
        ) VALUES (
          ${id}, ${visitId || null}, ${clientId}, ${user.id},
          ${mobilityScore || null}, ${wellbeingScale || null}, ${painLevel || null},
          ${goalAttainment ? JSON.stringify(goalAttainment) : null},
          ${behaviourFlags ? JSON.stringify(behaviourFlags) : null},
          ${independenceLevel || null}, ${skinIntegrity || null}, ${nutritionRisk || null},
          ${hydrationRisk || null}, ${cognitionLevel || null}, ${notes || null}
        )
      `

      res.status(201).json({ id, recorded: true })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[outcome-indicators] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
