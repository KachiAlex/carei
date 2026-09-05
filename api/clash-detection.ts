import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

const DEFAULT_SETTINGS = {
  minGapMinutes: 15,
  checkTravelTime: false,
  allowOverride: true,
}

// Parse duration string like "1 hr", "30 min", "90 min" into minutes
function parseDurationMinutes(duration: string | null | undefined): number {
  if (!duration) return 60
  const d = duration.toLowerCase()
  if (d.includes('hr')) {
    const n = parseFloat(d)
    return isNaN(n) ? 60 : Math.round(n * 60)
  }
  const n = parseInt(d)
  return isNaN(n) ? 60 : n
}

// Parse time string "HH:MM" into minutes since midnight
function parseTimeMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const m = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1]) * 60 + parseInt(m[2])
}

interface ClashResult {
  hasClash: boolean
  conflicts: Array<{
    type: 'double_booking' | 'gap_too_short'
    visitId: string
    clientName: string
    time: string
    duration: string
    overlapMinutes?: number
    gapMinutes?: number
  }>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // ---- GET: Fetch clash detection settings ----
    if (req.method === 'GET') {
      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          const rows = await tenantSql`
            SELECT min_gap_minutes AS "minGapMinutes",
              check_travel_time AS "checkTravelTime",
              allow_override AS "allowOverride"
            FROM clash_detection_settings
            WHERE tenant_id = ${tenantId}
            LIMIT 1
          ` as any[]
          res.status(200).json(rows[0] || DEFAULT_SETTINGS)
        })
        return
      }
      res.status(200).json(DEFAULT_SETTINGS)
      return
    }

    // ---- POST: Check for clashes or update settings ----
    if (req.method === 'POST') {
      const body = req.body || {}
      const { action } = body

      // Update settings
      if (action === 'update_settings') {
        const { minGapMinutes, checkTravelTime, allowOverride } = body
        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            const settingsId = 'clash_' + tenantId
            await tenantSql`
              INSERT INTO clash_detection_settings (id, tenant_id, min_gap_minutes, check_travel_time, allow_override, updated_at)
              VALUES (${settingsId}, ${tenantId}, ${minGapMinutes ?? 15}, ${checkTravelTime ?? false}, ${allowOverride ?? true}, NOW())
              ON CONFLICT (tenant_id) DO UPDATE SET
                min_gap_minutes = EXCLUDED.min_gap_minutes,
                check_travel_time = EXCLUDED.check_travel_time,
                allow_override = EXCLUDED.allow_override,
                updated_at = NOW()
            `
            res.status(200).json({ status: 'updated' })
          })
          return
        }
        res.status(200).json({ status: 'updated' })
        return
      }

      // Check for clashes
      if (action === 'check') {
        const { carerId, visitDate, time, duration, excludeVisitId } = body
        if (!carerId || !visitDate || !time) {
          res.status(400).json({ error: 'carerId, visitDate, time required' })
          return
        }

        const newStart = parseTimeMinutes(time)
        const newDuration = parseDurationMinutes(duration)
        if (newStart == null) {
          res.status(400).json({ error: 'Invalid time format' })
          return
        }
        const newEnd = newStart + newDuration

        // Get settings
        let settings = DEFAULT_SETTINGS
        if (tenantSlug) {
          // We need to fetch settings within tenant context
          // But we also need to query scheduled_visits — let's do both in withTenant
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            const settingsRows = await tenantSql`
              SELECT min_gap_minutes, check_travel_time, allow_override
              FROM clash_detection_settings
              WHERE tenant_id = ${tenantId}
              LIMIT 1
            ` as any[]
            if (settingsRows[0]) {
              settings = {
                minGapMinutes: settingsRows[0].min_gap_minutes || 15,
                checkTravelTime: settingsRows[0].check_travel_time || false,
                allowOverride: settingsRows[0].allow_override !== false,
              }
            }

            // Fetch all visits for this carer on this date
            const visits = await tenantSql`
              SELECT id, client_name, time, duration, carer_id
              FROM scheduled_visits
              WHERE tenant_id = ${tenantId}
                AND carer_id = ${carerId}
                AND visit_date = ${visitDate}
                ${excludeVisitId ? tenantSql`AND id != ${excludeVisitId}` : tenantSql``}
            ` as any[]

            const conflicts: ClashResult['conflicts'] = []

            for (const v of visits) {
              const vStart = parseTimeMinutes(v.time)
              if (vStart == null) continue
              const vDuration = parseDurationMinutes(v.duration)
              const vEnd = vStart + vDuration

              // Check for double-booking (overlap)
              if (newStart < vEnd && newEnd > vStart) {
                const overlap = Math.min(newEnd, vEnd) - Math.max(newStart, vStart)
                conflicts.push({
                  type: 'double_booking',
                  visitId: v.id,
                  clientName: v.client_name,
                  time: v.time,
                  duration: v.duration,
                  overlapMinutes: overlap,
                })
              } else {
                // Check gap time
                const gapBefore = vStart - newEnd // gap if new visit is before existing
                const gapAfter = newStart - vEnd  // gap if new visit is after existing

                if (gapBefore > 0 && gapBefore < settings.minGapMinutes) {
                  conflicts.push({
                    type: 'gap_too_short',
                    visitId: v.id,
                    clientName: v.client_name,
                    time: v.time,
                    duration: v.duration,
                    gapMinutes: gapBefore,
                  })
                } else if (gapAfter > 0 && gapAfter < settings.minGapMinutes) {
                  conflicts.push({
                    type: 'gap_too_short',
                    visitId: v.id,
                    clientName: v.client_name,
                    time: v.time,
                    duration: v.duration,
                    gapMinutes: gapAfter,
                  })
                }
              }
            }

            res.status(200).json({
              hasClash: conflicts.length > 0,
              conflicts,
              settings,
            })
          })
          return
        }

        // Legacy non-tenant
        const visits = await sql`
          SELECT id, client_name, time, duration
          FROM scheduled_visits
          WHERE carer_id = ${carerId}
            AND visit_date = ${visitDate}
            ${excludeVisitId ? sql`AND id != ${excludeVisitId}` : sql``}
        ` as any[]

        const conflicts: ClashResult['conflicts'] = []

        for (const v of visits) {
          const vStart = parseTimeMinutes(v.time)
          if (vStart == null) continue
          const vDuration = parseDurationMinutes(v.duration)
          const vEnd = vStart + vDuration

          if (newStart < vEnd && newEnd > vStart) {
            const overlap = Math.min(newEnd, vEnd) - Math.max(newStart, vStart)
            conflicts.push({
              type: 'double_booking',
              visitId: v.id,
              clientName: v.client_name,
              time: v.time,
              duration: v.duration,
              overlapMinutes: overlap,
            })
          } else {
            const gapBefore = vStart - newEnd
            const gapAfter = newStart - vEnd

            if (gapBefore > 0 && gapBefore < settings.minGapMinutes) {
              conflicts.push({
                type: 'gap_too_short',
                visitId: v.id,
                clientName: v.client_name,
                time: v.time,
                duration: v.duration,
                gapMinutes: gapBefore,
              })
            } else if (gapAfter > 0 && gapAfter < settings.minGapMinutes) {
              conflicts.push({
                type: 'gap_too_short',
                visitId: v.id,
                clientName: v.client_name,
                time: v.time,
                duration: v.duration,
                gapMinutes: gapAfter,
              })
            }
          }
        }

        res.status(200).json({
          hasClash: conflicts.length > 0,
          conflicts,
          settings,
        })
        return
      }

      res.status(400).json({ error: 'Unknown action' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
