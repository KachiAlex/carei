import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug, getAuthToken, getUserFromToken } from './db.js'

const CHECK_TYPES = ['British/Irish Passport', 'Share Code (EU Settlement)', 'Biometric Residence Permit', 'Visa & BRP', 'Other']

function computeExpiryStatus(passportExpiry: string | null, shareCodeExpiry: string | null, visaExpiry: string | null): string {
  const dates = [passportExpiry, shareCodeExpiry, visaExpiry].filter(Boolean) as string[]
  if (dates.length === 0) return 'valid'
  const soonest = dates.map((d) => new Date(d).getTime()).sort((a, b) => a - b)[0]
  const diffDays = Math.ceil((soonest - Date.now()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 90) return 'expiring'
  return 'valid'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // ---- GET ----
    if (req.method === 'GET') {
      const { carerId, summary } = req.query as { carerId?: string; summary?: string }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          if (summary === 'true') {
            const rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                check_type AS "checkType", passport_number AS "passportNumber",
                passport_expiry AS "passportExpiry", share_code AS "shareCode",
                share_code_expiry AS "shareCodeExpiry", nationality,
                visa_type AS "visaType", visa_expiry AS "visaExpiry",
                work_restriction AS "workRestriction", document_urls AS "documentUrls",
                verification_status AS "verificationStatus", verified_by AS "verifiedBy",
                verified_at AS "verifiedAt", notes, created_at AS "createdAt"
              FROM right_to_work_checks
              WHERE tenant_id = ${tenantId}
              ORDER BY carer_name
            ` as any[]

            const enriched = rows.map((r) => ({
              ...r,
              expiryStatus: computeExpiryStatus(r.passportExpiry, r.shareCodeExpiry, r.visaExpiry),
            }))

            const total = enriched.length
            const verified = enriched.filter((r) => r.verificationStatus === 'verified').length
            const pending = enriched.filter((r) => r.verificationStatus === 'pending').length
            const rejected = enriched.filter((r) => r.verificationStatus === 'rejected').length
            const expired = enriched.filter((r) => r.expiryStatus === 'expired').length
            const expiring = enriched.filter((r) => r.expiryStatus === 'expiring').length

            res.status(200).json({
              records: enriched,
              summary: { total, verified, pending, rejected, expired, expiring },
            })
            return
          }

          if (carerId) {
            const rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                check_type AS "checkType", passport_number AS "passportNumber",
                passport_expiry AS "passportExpiry", share_code AS "shareCode",
                share_code_expiry AS "shareCodeExpiry", nationality,
                visa_type AS "visaType", visa_expiry AS "visaExpiry",
                work_restriction AS "workRestriction", document_urls AS "documentUrls",
                verification_status AS "verificationStatus", verified_by AS "verifiedBy",
                verified_at AS "verifiedAt", notes
              FROM right_to_work_checks
              WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
              ORDER BY created_at DESC
            ` as any[]
            res.status(200).json({ records: rows })
            return
          }

          const rows = await tenantSql`
            SELECT id, carer_id AS "carerId", carer_name AS "carerName",
              check_type AS "checkType", passport_number AS "passportNumber",
              passport_expiry AS "passportExpiry", share_code AS "shareCode",
              share_code_expiry AS "shareCodeExpiry", nationality,
              visa_type AS "visaType", visa_expiry AS "visaExpiry",
              work_restriction AS "workRestriction", document_urls AS "documentUrls",
              verification_status AS "verificationStatus", verified_by AS "verifiedBy",
              verified_at AS "verifiedAt", notes
            FROM right_to_work_checks
            WHERE tenant_id = ${tenantId}
            ORDER BY carer_name
          ` as any[]
          res.status(200).json({ records: rows })
        })
        return
      }
      res.status(200).json({ records: [], summary: { total: 0, verified: 0, pending: 0, rejected: 0, expired: 0, expiring: 0 } })
      return
    }

    // ---- POST: Create, update, or verify ----
    if (req.method === 'POST') {
      const body = req.body || {}
      const { action } = body

      // Verify / reject action
      if (action === 'verify' || action === 'reject') {
        const { id } = body
        if (!id) {
          res.status(400).json({ error: 'id required' })
          return
        }
        const token = getAuthToken(req)
        const user = token ? await getUserFromToken(sql, token) : null
        const verifierName = user?.name || body.verifierName || 'Manager'
        const newStatus = action === 'verify' ? 'verified' : 'rejected'

        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            await tenantSql`
              UPDATE right_to_work_checks
              SET verification_status = ${newStatus},
                verified_by = ${verifierName},
                verified_at = NOW(),
                updated_at = NOW()
              WHERE id = ${id} AND tenant_id = ${tenantId}
            `
            res.status(200).json({ status: newStatus, id })
          })
          return
        }
        await sql`
          UPDATE right_to_work_checks
          SET verification_status = ${newStatus},
            verified_by = ${verifierName},
            verified_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
        `
        res.status(200).json({ status: newStatus, id })
        return
      }

      // Create or update record
      const {
        id, carerId, carerName, checkType,
        passportNumber, passportExpiry, shareCode, shareCodeExpiry,
        nationality, visaType, visaExpiry, workRestriction,
        documentUrls, notes,
      } = body

      if (!carerId) {
        res.status(400).json({ error: 'carerId required' })
        return
      }

      const recordId = id || 'rtw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          await tenantSql`
            INSERT INTO right_to_work_checks (
              id, tenant_id, carer_id, carer_name, check_type,
              passport_number, passport_expiry, share_code, share_code_expiry,
              nationality, visa_type, visa_expiry, work_restriction,
              document_urls, verification_status, notes, updated_at
            ) VALUES (
              ${recordId}, ${tenantId}, ${carerId}, ${carerName || null}, ${checkType || null},
              ${passportNumber || null}, ${passportExpiry || null},
              ${shareCode || null}, ${shareCodeExpiry || null},
              ${nationality || null}, ${visaType || null}, ${visaExpiry || null},
              ${workRestriction || null},
              ${JSON.stringify(documentUrls || [])}, 'pending',
              ${notes || null}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              carer_name = EXCLUDED.carer_name,
              check_type = EXCLUDED.check_type,
              passport_number = EXCLUDED.passport_number,
              passport_expiry = EXCLUDED.passport_expiry,
              share_code = EXCLUDED.share_code,
              share_code_expiry = EXCLUDED.share_code_expiry,
              nationality = EXCLUDED.nationality,
              visa_type = EXCLUDED.visa_type,
              visa_expiry = EXCLUDED.visa_expiry,
              work_restriction = EXCLUDED.work_restriction,
              document_urls = EXCLUDED.document_urls,
              notes = EXCLUDED.notes,
              updated_at = NOW()
          `
          res.status(200).json({ status: 'saved', id: recordId })
        })
        return
      }
      await sql`
        INSERT INTO right_to_work_checks (
          id, carer_id, carer_name, check_type,
          passport_number, passport_expiry, share_code, share_code_expiry,
          nationality, visa_type, visa_expiry, work_restriction,
          document_urls, verification_status, notes, updated_at
        ) VALUES (
          ${recordId}, ${carerId}, ${carerName || null}, ${checkType || null},
          ${passportNumber || null}, ${passportExpiry || null},
          ${shareCode || null}, ${shareCodeExpiry || null},
          ${nationality || null}, ${visaType || null}, ${visaExpiry || null},
          ${workRestriction || null},
          ${JSON.stringify(documentUrls || [])}, 'pending',
          ${notes || null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          carer_name = EXCLUDED.carer_name,
          check_type = EXCLUDED.check_type,
          passport_number = EXCLUDED.passport_number,
          passport_expiry = EXCLUDED.passport_expiry,
          share_code = EXCLUDED.share_code,
          share_code_expiry = EXCLUDED.share_code_expiry,
          nationality = EXCLUDED.nationality,
          visa_type = EXCLUDED.visa_type,
          visa_expiry = EXCLUDED.visa_expiry,
          work_restriction = EXCLUDED.work_restriction,
          document_urls = EXCLUDED.document_urls,
          notes = EXCLUDED.notes,
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
          await tenantSql`DELETE FROM right_to_work_checks WHERE id = ${id} AND tenant_id = ${tenantId}`
          res.status(200).json({ status: 'deleted', id })
        })
        return
      }
      await sql`DELETE FROM right_to_work_checks WHERE id = ${id}`
      res.status(200).json({ status: 'deleted', id })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
