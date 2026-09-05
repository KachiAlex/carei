import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

// CQC guidance: DBS checks don't formally expire, but best practice is to re-check
// every 3 years. We use 3 years from issue date as the "renewal reminder" threshold.
const RENEWAL_REMINDER_DAYS = 90 // Alert 90 days before the 3-year mark

function computeStatus(expiryDate: string | null, updateService: boolean): string {
  if (!expiryDate) return 'unknown'
  if (updateService) return 'valid' // Update service keeps it live
  const now = new Date()
  const expiry = new Date(expiryDate)
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= RENEWAL_REMINDER_DAYS) return 'expiring'
  return 'valid'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // ---- GET: Fetch DBS records ----
    if (req.method === 'GET') {
      const { carerId, summary } = req.query as { carerId?: string; summary?: string }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          if (summary === 'true') {
            // Compliance dashboard summary
            const rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                dbs_type AS "dbsType", dbs_number AS "dbsNumber",
                issue_date AS "issueDate", expiry_date AS "expiryDate",
                status, update_service AS "updateService",
                update_service_last_checked AS "updateServiceLastChecked",
                notes, document_url AS "documentUrl"
              FROM dbs_checks
              WHERE tenant_id = ${tenantId}
              ORDER BY expiry_date NULLS LAST
            ` as any[]

            const enriched = rows.map((r) => ({
              ...r,
              computedStatus: computeStatus(r.expiryDate, r.updateService),
            }))

            const total = enriched.length
            const valid = enriched.filter((r) => r.computedStatus === 'valid').length
            const expiring = enriched.filter((r) => r.computedStatus === 'expiring').length
            const expired = enriched.filter((r) => r.computedStatus === 'expired').length
            const unknown = enriched.filter((r) => r.computedStatus === 'unknown').length
            const complianceRate = total > 0 ? Math.round((valid / total) * 100) : 100

            res.status(200).json({
              records: enriched,
              summary: { total, valid, expiring, expired, unknown, complianceRate },
            })
            return
          }

          if (carerId) {
            const rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                dbs_type AS "dbsType", dbs_number AS "dbsNumber",
                issue_date AS "issueDate", expiry_date AS "expiryDate",
                status, update_service AS "updateService",
                update_service_last_checked AS "updateServiceLastChecked",
                notes, document_url AS "documentUrl"
              FROM dbs_checks
              WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
              ORDER BY issue_date DESC
            ` as any[]
            res.status(200).json({ records: rows })
            return
          }

          // All records
          const rows = await tenantSql`
            SELECT id, carer_id AS "carerId", carer_name AS "carerName",
              dbs_type AS "dbsType", dbs_number AS "dbsNumber",
              issue_date AS "issueDate", expiry_date AS "expiryDate",
              status, update_service AS "updateService",
              update_service_last_checked AS "updateServiceLastChecked",
              notes, document_url AS "documentUrl"
            FROM dbs_checks
            WHERE tenant_id = ${tenantId}
            ORDER BY expiry_date NULLS LAST
          ` as any[]
          res.status(200).json({ records: rows })
        })
        return
      }
      res.status(200).json({ records: [], summary: { total: 0, valid: 0, expiring: 0, expired: 0, unknown: 0, complianceRate: 100 } })
      return
    }

    // ---- POST: Create or update DBS record ----
    if (req.method === 'POST') {
      const body = req.body || {}
      const {
        id, carerId, carerName, dbsType, dbsNumber,
        issueDate, expiryDate, updateService, updateServiceLastChecked,
        notes, documentUrl,
      } = body

      if (!carerId) {
        res.status(400).json({ error: 'carerId required' })
        return
      }

      const recordId = id || 'dbs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
      const computedStatus = computeStatus(expiryDate || null, updateService || false)

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          await tenantSql`
            INSERT INTO dbs_checks (
              id, tenant_id, carer_id, carer_name, dbs_type, dbs_number,
              issue_date, expiry_date, status, update_service,
              update_service_last_checked, notes, document_url, updated_at
            ) VALUES (
              ${recordId}, ${tenantId}, ${carerId}, ${carerName || null},
              ${dbsType || 'standard'}, ${dbsNumber || null},
              ${issueDate || null}, ${expiryDate || null},
              ${computedStatus}, ${updateService || false},
              ${updateServiceLastChecked || null}, ${notes || null},
              ${documentUrl || null}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              carer_name = EXCLUDED.carer_name,
              dbs_type = EXCLUDED.dbs_type,
              dbs_number = EXCLUDED.dbs_number,
              issue_date = EXCLUDED.issue_date,
              expiry_date = EXCLUDED.expiry_date,
              status = EXCLUDED.status,
              update_service = EXCLUDED.update_service,
              update_service_last_checked = EXCLUDED.update_service_last_checked,
              notes = EXCLUDED.notes,
              document_url = EXCLUDED.document_url,
              updated_at = NOW()
          `
          res.status(200).json({ status: 'saved', id: recordId })
        })
        return
      }
      await sql`
        INSERT INTO dbs_checks (
          id, carer_id, carer_name, dbs_type, dbs_number,
          issue_date, expiry_date, status, update_service,
          update_service_last_checked, notes, document_url, updated_at
        ) VALUES (
          ${recordId}, ${carerId}, ${carerName || null},
          ${dbsType || 'standard'}, ${dbsNumber || null},
          ${issueDate || null}, ${expiryDate || null},
          ${computedStatus}, ${updateService || false},
          ${updateServiceLastChecked || null}, ${notes || null},
          ${documentUrl || null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          carer_name = EXCLUDED.carer_name,
          dbs_type = EXCLUDED.dbs_type,
          dbs_number = EXCLUDED.dbs_number,
          issue_date = EXCLUDED.issue_date,
          expiry_date = EXCLUDED.expiry_date,
          status = EXCLUDED.status,
          update_service = EXCLUDED.update_service,
          update_service_last_checked = EXCLUDED.update_service_last_checked,
          notes = EXCLUDED.notes,
          document_url = EXCLUDED.document_url,
          updated_at = NOW()
      `
      res.status(200).json({ status: 'saved', id: recordId })
      return
    }

    // ---- DELETE ----
    if (req.method === 'DELETE') {
      const { id } = req.query as { id?: string }
      if (!id) {
        res.status(400).json({ error: 'id required' })
        return
      }
      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          await tenantSql`DELETE FROM dbs_checks WHERE id = ${id} AND tenant_id = ${tenantId}`
          res.status(200).json({ status: 'deleted', id })
        })
        return
      }
      await sql`DELETE FROM dbs_checks WHERE id = ${id}`
      res.status(200).json({ status: 'deleted', id })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
