import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

const RENEWAL_REMINDER_DAYS = 60

function computeStatus(expiryDate: string | null | undefined): string {
  if (!expiryDate) return 'valid' // No expiry = doesn't expire
  const now = new Date()
  const expiry = new Date(expiryDate)
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= RENEWAL_REMINDER_DAYS) return 'expiring'
  return 'valid'
}

const CATEGORIES = ['Mandatory', 'Clinical', 'Safety', 'Safeguarding', 'Infection Control', 'Dementia Care', 'First Aid', 'Moving & Handling', 'Other']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // ---- GET ----
    if (req.method === 'GET') {
      const { carerId, summary, category } = req.query as {
        carerId?: string
        summary?: string
        category?: string
      }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          if (summary === 'true') {
            const rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                course_name AS "courseName", category, provider,
                completion_date AS "completionDate", expiry_date AS "expiryDate",
                certificate_number AS "certificateNumber", status, score,
                notes, document_url AS "documentUrl"
              FROM training_certifications
              WHERE tenant_id = ${tenantId}
              ORDER BY expiry_date NULLS LAST, carer_name
            ` as any[]

            const enriched = rows.map((r) => ({
              ...r,
              computedStatus: computeStatus(r.expiryDate),
            }))

            const total = enriched.length
            const valid = enriched.filter((r) => r.computedStatus === 'valid').length
            const expiring = enriched.filter((r) => r.computedStatus === 'expiring').length
            const expired = enriched.filter((r) => r.computedStatus === 'expired').length

            // Category breakdown
            const byCategory: Record<string, number> = {}
            enriched.forEach((r) => {
              const cat = r.category || 'Uncategorized'
              byCategory[cat] = (byCategory[cat] || 0) + 1
            })

            // Unique carers with at least one record
            const carerIds = new Set(enriched.map((r) => r.carerId))

            res.status(200).json({
              records: enriched,
              summary: { total, valid, expiring, expired, carerCount: carerIds.size, byCategory },
            })
            return
          }

          let rows
          if (carerId) {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                course_name AS "courseName", category, provider,
                completion_date AS "completionDate", expiry_date AS "expiryDate",
                certificate_number AS "certificateNumber", status, score,
                notes, document_url AS "documentUrl"
              FROM training_certifications
              WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
              ORDER BY completion_date DESC
            ` as any[]
          } else if (category) {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                course_name AS "courseName", category, provider,
                completion_date AS "completionDate", expiry_date AS "expiryDate",
                certificate_number AS "certificateNumber", status, score,
                notes, document_url AS "documentUrl"
              FROM training_certifications
              WHERE tenant_id = ${tenantId} AND category = ${category}
              ORDER BY expiry_date NULLS LAST, carer_name
            ` as any[]
          } else {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                course_name AS "courseName", category, provider,
                completion_date AS "completionDate", expiry_date AS "expiryDate",
                certificate_number AS "certificateNumber", status, score,
                notes, document_url AS "documentUrl"
              FROM training_certifications
              WHERE tenant_id = ${tenantId}
              ORDER BY expiry_date NULLS LAST, carer_name
            ` as any[]
          }
          res.status(200).json({ records: rows })
        })
        return
      }
      res.status(200).json({ records: [], summary: { total: 0, valid: 0, expiring: 0, expired: 0, carerCount: 0, byCategory: {} } })
      return
    }

    // ---- POST: Create or update ----
    if (req.method === 'POST') {
      const body = req.body || {}
      const {
        id, carerId, carerName, courseName, category, provider,
        completionDate, expiryDate, certificateNumber, score, notes, documentUrl,
      } = body

      if (!carerId || !courseName) {
        res.status(400).json({ error: 'carerId and courseName required' })
        return
      }

      const recordId = id || 'train_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
      const computedStatus = computeStatus(expiryDate || null)

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          await tenantSql`
            INSERT INTO training_certifications (
              id, tenant_id, carer_id, carer_name, course_name, category, provider,
              completion_date, expiry_date, certificate_number, status, score, notes, document_url, updated_at
            ) VALUES (
              ${recordId}, ${tenantId}, ${carerId}, ${carerName || null}, ${courseName},
              ${category || null}, ${provider || null},
              ${completionDate || null}, ${expiryDate || null},
              ${certificateNumber || null}, ${computedStatus}, ${score || null},
              ${notes || null}, ${documentUrl || null}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              carer_name = EXCLUDED.carer_name,
              course_name = EXCLUDED.course_name,
              category = EXCLUDED.category,
              provider = EXCLUDED.provider,
              completion_date = EXCLUDED.completion_date,
              expiry_date = EXCLUDED.expiry_date,
              certificate_number = EXCLUDED.certificate_number,
              status = EXCLUDED.status,
              score = EXCLUDED.score,
              notes = EXCLUDED.notes,
              document_url = EXCLUDED.document_url,
              updated_at = NOW()
          `
          res.status(200).json({ status: 'saved', id: recordId })
        })
        return
      }
      await sql`
        INSERT INTO training_certifications (
          id, carer_id, carer_name, course_name, category, provider,
          completion_date, expiry_date, certificate_number, status, score, notes, document_url, updated_at
        ) VALUES (
          ${recordId}, ${carerId}, ${carerName || null}, ${courseName},
          ${category || null}, ${provider || null},
          ${completionDate || null}, ${expiryDate || null},
          ${certificateNumber || null}, ${computedStatus}, ${score || null},
          ${notes || null}, ${documentUrl || null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          carer_name = EXCLUDED.carer_name,
          course_name = EXCLUDED.course_name,
          category = EXCLUDED.category,
          provider = EXCLUDED.provider,
          completion_date = EXCLUDED.completion_date,
          expiry_date = EXCLUDED.expiry_date,
          certificate_number = EXCLUDED.certificate_number,
          status = EXCLUDED.status,
          score = EXCLUDED.score,
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
          await tenantSql`DELETE FROM training_certifications WHERE id = ${id} AND tenant_id = ${tenantId}`
          res.status(200).json({ status: 'deleted', id })
        })
        return
      }
      await sql`DELETE FROM training_certifications WHERE id = ${id}`
      res.status(200).json({ status: 'deleted', id })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
