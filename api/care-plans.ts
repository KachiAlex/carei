import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug, getAuthToken, getUserFromToken } from './db.js'

function generateId(): string {
  return 'cp-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  // Helper: serialize string[] for postgres (neon tagged templates handle arrays natively)
  const toArray = (val: unknown): string[] | null => {
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string')
    if (typeof val === 'string') return val.split('\n').map(s => s.trim()).filter(Boolean)
    return null
  }

  if (tenantSlug) {
    await withTenant(req, res, async ({ tenantId, userId, role, sql }) => {
      const isManager = role === 'manager' || role === 'admin' || role === 'superadmin'

      // GET /care-plans?clientId=xxx  -> fetch active plan for client
      if (req.method === 'GET') {
        const { clientId } = req.query as { clientId?: string }
        if (!clientId) {
          res.status(400).json({ error: 'clientId is required' })
          return
        }

        const rows = await sql`
          SELECT * FROM care_plans
          WHERE client_id = ${clientId} AND tenant_id = ${tenantId}
          ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, version DESC
          LIMIT 1
        ` as any[]

        res.status(200).json({ plan: rows[0] || null })
        return
      }

      // POST /care-plans  -> create new draft
      if (req.method === 'POST') {
        if (!isManager) {
          res.status(403).json({ error: 'Managers only' })
          return
        }
        const body = req.body || {}
        const { clientId, objectives, preventive, risks, postMed, lastReview, pbsTriggers, safetyPlan,
                pbsCalmSigns, pbsCalmActions, pbsAnxiousSigns, pbsAnxiousActions, pbsRiskSigns, pbsRiskActions } = body

        if (!clientId) {
          res.status(400).json({ error: 'clientId is required' })
          return
        }

        // Archive any existing published plan
        await sql`
          UPDATE care_plans SET status = 'archived'
          WHERE client_id = ${clientId} AND tenant_id = ${tenantId} AND status = 'published'
        `

        const id = generateId()
        await sql`
          INSERT INTO care_plans (
            id, client_id, tenant_id, created_by, updated_by, status, version,
            objectives, preventive, risks, post_med, last_review, pbs_triggers, safety_plan,
            pbs_calm_signs, pbs_calm_actions, pbs_anxious_signs, pbs_anxious_actions,
            pbs_risk_signs, pbs_risk_actions
          ) VALUES (
            ${id}, ${clientId}, ${tenantId}, ${userId}, ${userId}, 'draft', 1,
            ${toArray(objectives)}, ${toArray(preventive)}, ${toArray(risks)}, ${toArray(postMed)},
            ${toArray(lastReview)}, ${toArray(pbsTriggers)}, ${toArray(safetyPlan)},
            ${toArray(pbsCalmSigns)}, ${toArray(pbsCalmActions)}, ${toArray(pbsAnxiousSigns)},
            ${toArray(pbsAnxiousActions)}, ${toArray(pbsRiskSigns)}, ${toArray(pbsRiskActions)}
          )
        `

        res.status(201).json({ id, status: 'draft', version: 1 })
        return
      }

      // PUT /care-plans?id=xxx  -> update draft
      if (req.method === 'PUT' || req.method === 'PATCH') {
        if (!isManager) {
          res.status(403).json({ error: 'Managers only' })
          return
        }
        const { id: planId, action } = req.query as { id?: string; action?: string }
        if (!planId) {
          res.status(400).json({ error: 'id is required' })
          return
        }

        // PATCH /care-plans?id=xxx&action=publish
        if (action === 'publish') {
          const existing = await sql`
            SELECT client_id FROM care_plans WHERE id = ${planId} AND tenant_id = ${tenantId} LIMIT 1
          ` as any[]
          if (!existing[0]) {
            res.status(404).json({ error: 'Care plan not found' })
            return
          }
          // Archive current published for this client
          await sql`
            UPDATE care_plans SET status = 'archived'
            WHERE client_id = ${existing[0].client_id} AND tenant_id = ${tenantId} AND status = 'published'
          `
          await sql`
            UPDATE care_plans SET status = 'published', published_at = NOW(), updated_by = ${userId}, updated_at = NOW()
            WHERE id = ${planId}
          `
          res.status(200).json({ id: planId, status: 'published' })
          return
        }

        // PATCH /care-plans?id=xxx&action=archive
        if (action === 'archive') {
          await sql`
            UPDATE care_plans SET status = 'archived', updated_by = ${userId}, updated_at = NOW()
            WHERE id = ${planId} AND tenant_id = ${tenantId}
          `
          res.status(200).json({ id: planId, status: 'archived' })
          return
        }

        const existing = await sql`
          SELECT * FROM care_plans WHERE id = ${planId} AND tenant_id = ${tenantId} LIMIT 1
        ` as any[]
        if (!existing[0]) {
          res.status(404).json({ error: 'Care plan not found' })
          return
        }

        const body = req.body || {}
        const { objectives, preventive, risks, postMed, lastReview, pbsTriggers, safetyPlan,
                pbsCalmSigns, pbsCalmActions, pbsAnxiousSigns, pbsAnxiousActions, pbsRiskSigns, pbsRiskActions } = body

        const nextVersion = (existing[0].version || 1) + 1

        await sql`
          UPDATE care_plans SET
            version = ${nextVersion},
            updated_by = ${userId},
            updated_at = NOW(),
            objectives = COALESCE(${toArray(objectives)}, objectives),
            preventive = COALESCE(${toArray(preventive)}, preventive),
            risks = COALESCE(${toArray(risks)}, risks),
            post_med = COALESCE(${toArray(postMed)}, post_med),
            last_review = COALESCE(${toArray(lastReview)}, last_review),
            pbs_triggers = COALESCE(${toArray(pbsTriggers)}, pbs_triggers),
            safety_plan = COALESCE(${toArray(safetyPlan)}, safety_plan),
            pbs_calm_signs = COALESCE(${toArray(pbsCalmSigns)}, pbs_calm_signs),
            pbs_calm_actions = COALESCE(${toArray(pbsCalmActions)}, pbs_calm_actions),
            pbs_anxious_signs = COALESCE(${toArray(pbsAnxiousSigns)}, pbs_anxious_signs),
            pbs_anxious_actions = COALESCE(${toArray(pbsAnxiousActions)}, pbs_anxious_actions),
            pbs_risk_signs = COALESCE(${toArray(pbsRiskSigns)}, pbs_risk_signs),
            pbs_risk_actions = COALESCE(${toArray(pbsRiskActions)}, pbs_risk_actions)
          WHERE id = ${planId}
        `

        res.status(200).json({ id: planId, version: nextVersion })
        return
      }

      res.status(405).json({ error: 'Method not allowed' })
    })
    return
  }

  // Legacy non-tenant handler
  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    const isManager = user.role === 'manager' || user.role === 'admin' || user.role === 'superadmin'

    if (req.method === 'GET') {
      const { clientId } = req.query as { clientId?: string }
      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' })
        return
      }

      const rows = await sql`
        SELECT * FROM care_plans WHERE client_id = ${clientId}
        ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, version DESC
        LIMIT 1
      ` as any[]

      res.status(200).json({ plan: rows[0] || null })
      return
    }

    if (req.method === 'POST') {
      if (!isManager) {
        res.status(403).json({ error: 'Managers only' })
        return
      }
      const body = req.body || {}
      const { clientId, objectives, preventive, risks, postMed, lastReview, pbsTriggers, safetyPlan,
              pbsCalmSigns, pbsCalmActions, pbsAnxiousSigns, pbsAnxiousActions, pbsRiskSigns, pbsRiskActions } = body

      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' })
        return
      }

      await sql`UPDATE care_plans SET status = 'archived' WHERE client_id = ${clientId} AND status = 'published'`

      const id = generateId()
      await sql`
        INSERT INTO care_plans (
          id, client_id, tenant_id, created_by, updated_by, status, version,
          objectives, preventive, risks, post_med, last_review, pbs_triggers, safety_plan,
          pbs_calm_signs, pbs_calm_actions, pbs_anxious_signs, pbs_anxious_actions,
          pbs_risk_signs, pbs_risk_actions
        ) VALUES (
          ${id}, ${clientId}, 'default-tenant', ${user.id}, ${user.id}, 'draft', 1,
          ${toArray(objectives)}, ${toArray(preventive)}, ${toArray(risks)}, ${toArray(postMed)},
          ${toArray(lastReview)}, ${toArray(pbsTriggers)}, ${toArray(safetyPlan)},
          ${toArray(pbsCalmSigns)}, ${toArray(pbsCalmActions)}, ${toArray(pbsAnxiousSigns)},
          ${toArray(pbsAnxiousActions)}, ${toArray(pbsRiskSigns)}, ${toArray(pbsRiskActions)}
        )
      `

      res.status(201).json({ id, status: 'draft', version: 1 })
      return
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!isManager) {
        res.status(403).json({ error: 'Managers only' })
        return
      }
      const { id: planId, action } = req.query as { id?: string; action?: string }
      if (!planId) {
        res.status(400).json({ error: 'id is required' })
        return
      }

      if (action === 'publish') {
        const existing = await sql`SELECT client_id FROM care_plans WHERE id = ${planId} LIMIT 1` as any[]
        if (!existing[0]) {
          res.status(404).json({ error: 'Care plan not found' })
          return
        }
        await sql`UPDATE care_plans SET status = 'archived' WHERE client_id = ${existing[0].client_id} AND status = 'published'`
        await sql`UPDATE care_plans SET status = 'published', published_at = NOW(), updated_by = ${user.id}, updated_at = NOW() WHERE id = ${planId}`
        res.status(200).json({ id: planId, status: 'published' })
        return
      }

      if (action === 'archive') {
        await sql`UPDATE care_plans SET status = 'archived', updated_by = ${user.id}, updated_at = NOW() WHERE id = ${planId}`
        res.status(200).json({ id: planId, status: 'archived' })
        return
      }

      const existing = await sql`SELECT * FROM care_plans WHERE id = ${planId} LIMIT 1` as any[]
      if (!existing[0]) {
        res.status(404).json({ error: 'Care plan not found' })
        return
      }

      const body = req.body || {}
      const { objectives, preventive, risks, postMed, lastReview, pbsTriggers, safetyPlan,
              pbsCalmSigns, pbsCalmActions, pbsAnxiousSigns, pbsAnxiousActions, pbsRiskSigns, pbsRiskActions } = body
      const nextVersion = (existing[0].version || 1) + 1

      await sql`
        UPDATE care_plans SET
          version = ${nextVersion},
          updated_by = ${user.id},
          updated_at = NOW(),
          objectives = COALESCE(${toArray(objectives)}, objectives),
          preventive = COALESCE(${toArray(preventive)}, preventive),
          risks = COALESCE(${toArray(risks)}, risks),
          post_med = COALESCE(${toArray(postMed)}, post_med),
          last_review = COALESCE(${toArray(lastReview)}, last_review),
          pbs_triggers = COALESCE(${toArray(pbsTriggers)}, pbs_triggers),
          safety_plan = COALESCE(${toArray(safetyPlan)}, safety_plan),
          pbs_calm_signs = COALESCE(${toArray(pbsCalmSigns)}, pbs_calm_signs),
          pbs_calm_actions = COALESCE(${toArray(pbsCalmActions)}, pbs_calm_actions),
          pbs_anxious_signs = COALESCE(${toArray(pbsAnxiousSigns)}, pbs_anxious_signs),
          pbs_anxious_actions = COALESCE(${toArray(pbsAnxiousActions)}, pbs_anxious_actions),
          pbs_risk_signs = COALESCE(${toArray(pbsRiskSigns)}, pbs_risk_signs),
          pbs_risk_actions = COALESCE(${toArray(pbsRiskActions)}, pbs_risk_actions)
        WHERE id = ${planId}
      `

      res.status(200).json({ id: planId, version: nextVersion })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}
