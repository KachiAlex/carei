import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

const DEFAULT_POLICY = {
  visitDraftRetentionDays: 30,
  completedVisitRetentionDays: 365,
  medicationLogRetentionDays: 365,
  incidentRetentionDays: 2555,
  voiceMemoRetentionDays: 90,
  offlineQueueRetentionHours: 72,
  autoPurgeEnabled: true,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // ---- GET: Fetch retention policy ----
    if (req.method === 'GET') {
      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          const rows = await tenantSql`
            SELECT
              visit_draft_retention_days AS "visitDraftRetentionDays",
              completed_visit_retention_days AS "completedVisitRetentionDays",
              medication_log_retention_days AS "medicationLogRetentionDays",
              incident_retention_days AS "incidentRetentionDays",
              voice_memo_retention_days AS "voiceMemoRetentionDays",
              offline_queue_retention_hours AS "offlineQueueRetentionHours",
              auto_purge_enabled AS "autoPurgeEnabled"
            FROM data_retention_policies
            WHERE tenant_id = ${tenantId}
            LIMIT 1
          ` as any[]
          res.status(200).json(rows[0] || DEFAULT_POLICY)
        })
        return
      }
      res.status(200).json(DEFAULT_POLICY)
      return
    }

    // ---- POST: Update policy OR trigger purge ----
    if (req.method === 'POST') {
      const body = req.body || {}
      const action = body.action

      // Update policy
      if (action === 'update') {
        const {
          visitDraftRetentionDays,
          completedVisitRetentionDays,
          medicationLogRetentionDays,
          incidentRetentionDays,
          voiceMemoRetentionDays,
          offlineQueueRetentionHours,
          autoPurgeEnabled,
        } = body

        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            const policyId = 'policy_' + tenantId
            await tenantSql`
              INSERT INTO data_retention_policies (
                id, tenant_id,
                visit_draft_retention_days,
                completed_visit_retention_days,
                medication_log_retention_days,
                incident_retention_days,
                voice_memo_retention_days,
                offline_queue_retention_hours,
                auto_purge_enabled,
                updated_at
              ) VALUES (
                ${policyId}, ${tenantId},
                ${visitDraftRetentionDays ?? DEFAULT_POLICY.visitDraftRetentionDays},
                ${completedVisitRetentionDays ?? DEFAULT_POLICY.completedVisitRetentionDays},
                ${medicationLogRetentionDays ?? DEFAULT_POLICY.medicationLogRetentionDays},
                ${incidentRetentionDays ?? DEFAULT_POLICY.incidentRetentionDays},
                ${voiceMemoRetentionDays ?? DEFAULT_POLICY.voiceMemoRetentionDays},
                ${offlineQueueRetentionHours ?? DEFAULT_POLICY.offlineQueueRetentionHours},
                ${autoPurgeEnabled ?? DEFAULT_POLICY.autoPurgeEnabled},
                NOW()
              )
              ON CONFLICT (tenant_id) DO UPDATE SET
                visit_draft_retention_days = EXCLUDED.visit_draft_retention_days,
                completed_visit_retention_days = EXCLUDED.completed_visit_retention_days,
                medication_log_retention_days = EXCLUDED.medication_log_retention_days,
                incident_retention_days = EXCLUDED.incident_retention_days,
                voice_memo_retention_days = EXCLUDED.voice_memo_retention_days,
                offline_queue_retention_hours = EXCLUDED.offline_queue_retention_hours,
                auto_purge_enabled = EXCLUDED.auto_purge_enabled,
                updated_at = NOW()
            `
            res.status(200).json({ status: 'updated' })
          })
          return
        }
        res.status(200).json({ status: 'updated' })
        return
      }

      // Trigger purge
      const results: Record<string, number> = {}

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          const policyRows = await tenantSql`
            SELECT * FROM data_retention_policies WHERE tenant_id = ${tenantId} LIMIT 1
          ` as any[]
          const p = policyRows[0] || {}

          const draftDays = p.visit_draft_retention_days || DEFAULT_POLICY.visitDraftRetentionDays
          const visitDays = p.completed_visit_retention_days || DEFAULT_POLICY.completedVisitRetentionDays
          const medDays = p.medication_log_retention_days || DEFAULT_POLICY.medicationLogRetentionDays
          const incidentDays = p.incident_retention_days || DEFAULT_POLICY.incidentRetentionDays
          const memoDays = p.voice_memo_retention_days || DEFAULT_POLICY.voiceMemoRetentionDays

          const draftResult = await tenantSql`
            DELETE FROM visit_drafts
            WHERE updated_at < NOW() - ${draftDays} * INTERVAL '1 day'
            RETURNING id
          `
          results.visitDraftsPurged = draftResult.length

          const visitResult = await tenantSql`
            DELETE FROM visits
            WHERE tenant_id = ${tenantId}
              AND status = 'completed'
              AND clock_out_at < NOW() - ${visitDays} * INTERVAL '1 day'
            RETURNING id
          `
          results.visitsPurged = visitResult.length

          const medResult = await tenantSql`
            DELETE FROM medication_logs
            WHERE tenant_id = ${tenantId}
              AND created_at < NOW() - ${medDays} * INTERVAL '1 day'
            RETURNING id
          `
          results.medicationLogsPurged = medResult.length

          const incidentResult = await tenantSql`
            DELETE FROM incidents
            WHERE tenant_id = ${tenantId}
              AND created_at < NOW() - ${incidentDays} * INTERVAL '1 day'
            RETURNING id
          `
          results.incidentsPurged = incidentResult.length

          const memoResult = await tenantSql`
            DELETE FROM voice_memos
            WHERE tenant_id = ${tenantId}
              AND created_at < NOW() - ${memoDays} * INTERVAL '1 day'
            RETURNING id
          `
          results.voiceMemosPurged = memoResult.length

          res.status(200).json({ status: 'purged', results })
        })
        return
      }

      // Legacy non-tenant purge
      const draftResult = await sql`
        DELETE FROM visit_drafts
        WHERE updated_at < NOW() - 30 * INTERVAL '1 day'
        RETURNING id
      `
      results.visitDraftsPurged = draftResult.length

      const visitResult = await sql`
        DELETE FROM visits
        WHERE status = 'completed'
          AND clock_out_at < NOW() - 365 * INTERVAL '1 day'
        RETURNING id
      `
      results.visitsPurged = visitResult.length

      res.status(200).json({ status: 'purged', results })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
