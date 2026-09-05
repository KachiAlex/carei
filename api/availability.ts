import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // ---- GET: Fetch availability and/or leave requests ----
    if (req.method === 'GET') {
      const { carerId, type, fromDate, toDate } = req.query as {
        carerId?: string
        type?: string
        fromDate?: string
        toDate?: string
      }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          // Fetch availability slots
          if (!type || type === 'availability') {
            const availRows = carerId
              ? await tenantSql`
                SELECT id, carer_id AS "carerId", day_of_week AS "dayOfWeek",
                  start_time AS "startTime", end_time AS "endTime", is_available AS "isAvailable"
                FROM carer_availability
                WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
                ORDER BY day_of_week, start_time
              `
              : await tenantSql`
                SELECT id, carer_id AS "carerId", day_of_week AS "dayOfWeek",
                  start_time AS "startTime", end_time AS "endTime", is_available AS "isAvailable"
                FROM carer_availability
                WHERE tenant_id = ${tenantId}
                ORDER BY carer_id, day_of_week, start_time
              `
            res.status(200).json({ availability: availRows })
            return
          }

          // Fetch leave requests
          if (type === 'leave') {
            let leaveRows
            if (carerId) {
              leaveRows = await tenantSql`
                SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                  leave_type AS "leaveType", start_date AS "startDate", end_date AS "endDate",
                  reason, status, reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
                  created_at AS "createdAt"
                FROM leave_requests
                WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
                ORDER BY created_at DESC
              `
            } else if (fromDate && toDate) {
              leaveRows = await tenantSql`
                SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                  leave_type AS "leaveType", start_date AS "startDate", end_date AS "endDate",
                  reason, status, reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
                  created_at AS "createdAt"
                FROM leave_requests
                WHERE tenant_id = ${tenantId}
                  AND start_date <= ${toDate} AND end_date >= ${fromDate}
                ORDER BY created_at DESC
              `
            } else {
              leaveRows = await tenantSql`
                SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                  leave_type AS "leaveType", start_date AS "startDate", end_date AS "endDate",
                  reason, status, reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
                  created_at AS "createdAt"
                FROM leave_requests
                WHERE tenant_id = ${tenantId}
                ORDER BY created_at DESC
                LIMIT 100
              `
            }
            res.status(200).json({ leaveRequests: leaveRows })
            return
          }

          // Fetch both
          const availRows = carerId
            ? await tenantSql`
              SELECT id, carer_id AS "carerId", day_of_week AS "dayOfWeek",
                start_time AS "startTime", end_time AS "endTime", is_available AS "isAvailable"
              FROM carer_availability
              WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
              ORDER BY day_of_week, start_time
            `
            : []
          const leaveRows = carerId
            ? await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                leave_type AS "leaveType", start_date AS "startDate", end_date AS "endDate",
                reason, status, reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
                created_at AS "createdAt"
              FROM leave_requests
              WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
              ORDER BY created_at DESC
            `
            : await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                leave_type AS "leaveType", start_date AS "startDate", end_date AS "endDate",
                reason, status, reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
                created_at AS "createdAt"
              FROM leave_requests
              WHERE tenant_id = ${tenantId}
              ORDER BY created_at DESC
              LIMIT 100
            `
          res.status(200).json({ availability: availRows, leaveRequests: leaveRows })
        })
        return
      }

      // Legacy non-tenant
      if (type === 'leave') {
        const leaveRows = await sql`
          SELECT id, carer_id AS "carerId", carer_name AS "carerName",
            leave_type AS "leaveType", start_date AS "startDate", end_date AS "endDate",
            reason, status, created_at AS "createdAt"
          FROM leave_requests
          ORDER BY created_at DESC LIMIT 100
        `
        res.status(200).json({ leaveRequests: leaveRows })
      } else {
        res.status(200).json({ availability: [], leaveRequests: [] })
      }
      return
    }

    // ---- POST: Create availability slot or leave request ----
    if (req.method === 'POST') {
      const body = req.body || {}
      const { action } = body

      // Create/update availability slot
      if (action === 'availability') {
        const { carerId, dayOfWeek, startTime, endTime, isAvailable, slotId } = body
        if (!carerId || dayOfWeek == null || !startTime || !endTime) {
          res.status(400).json({ error: 'carerId, dayOfWeek, startTime, endTime required' })
          return
        }
        const id = slotId || 'avail_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)

        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            await tenantSql`
              INSERT INTO carer_availability (id, tenant_id, carer_id, day_of_week, start_time, end_time, is_available)
              VALUES (${id}, ${tenantId}, ${carerId}, ${dayOfWeek}, ${startTime}, ${endTime}, ${isAvailable ?? true})
              ON CONFLICT (id) DO UPDATE SET
                day_of_week = EXCLUDED.day_of_week,
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                is_available = EXCLUDED.is_available
            `
            res.status(200).json({ status: 'saved', id })
          })
          return
        }
        await sql`
          INSERT INTO carer_availability (id, carer_id, day_of_week, start_time, end_time, is_available)
          VALUES (${id}, ${carerId}, ${dayOfWeek}, ${startTime}, ${endTime}, ${isAvailable ?? true})
          ON CONFLICT (id) DO UPDATE SET
            day_of_week = EXCLUDED.day_of_week,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            is_available = EXCLUDED.is_available
        `
        res.status(200).json({ status: 'saved', id })
        return
      }

      // Create leave request
      if (action === 'leave') {
        const { carerId, carerName, leaveType, startDate, endDate, reason } = body
        if (!carerId || !leaveType || !startDate || !endDate) {
          res.status(400).json({ error: 'carerId, leaveType, startDate, endDate required' })
          return
        }
        const id = 'leave_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)

        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            await tenantSql`
              INSERT INTO leave_requests (id, tenant_id, carer_id, carer_name, leave_type, start_date, end_date, reason)
              VALUES (${id}, ${tenantId}, ${carerId}, ${carerName || null}, ${leaveType}, ${startDate}, ${endDate}, ${reason || null})
            `
            res.status(201).json({ status: 'created', id })
          })
          return
        }
        await sql`
          INSERT INTO leave_requests (id, carer_id, carer_name, leave_type, start_date, end_date, reason)
          VALUES (${id}, ${carerId}, ${carerName || null}, ${leaveType}, ${startDate}, ${endDate}, ${reason || null})
        `
        res.status(201).json({ status: 'created', id })
        return
      }

      // Approve/reject leave request
      if (action === 'review') {
        const { leaveId, decision, reviewedBy } = body
        if (!leaveId || !decision) {
          res.status(400).json({ error: 'leaveId, decision required' })
          return
        }
        const status = decision === 'approve' ? 'approved' : 'rejected'

        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            await tenantSql`
              UPDATE leave_requests
              SET status = ${status}, reviewed_by = ${reviewedBy || null}, reviewed_at = NOW()
              WHERE id = ${leaveId} AND tenant_id = ${tenantId}
            `
            res.status(200).json({ status: 'reviewed', leaveId, decision: status })
          })
          return
        }
        await sql`
          UPDATE leave_requests
          SET status = ${status}, reviewed_at = NOW()
          WHERE id = ${leaveId}
        `
        res.status(200).json({ status: 'reviewed', leaveId, decision: status })
        return
      }

      res.status(400).json({ error: 'Unknown action' })
      return
    }

    // ---- DELETE: Remove availability slot ----
    if (req.method === 'DELETE') {
      const { slotId, leaveId } = req.query as { slotId?: string; leaveId?: string }

      if (slotId) {
        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            await tenantSql`DELETE FROM carer_availability WHERE id = ${slotId} AND tenant_id = ${tenantId}`
            res.status(200).json({ status: 'deleted', slotId })
          })
          return
        }
        await sql`DELETE FROM carer_availability WHERE id = ${slotId}`
        res.status(200).json({ status: 'deleted', slotId })
        return
      }

      if (leaveId) {
        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            await tenantSql`DELETE FROM leave_requests WHERE id = ${leaveId} AND tenant_id = ${tenantId}`
            res.status(200).json({ status: 'deleted', leaveId })
          })
          return
        }
        await sql`DELETE FROM leave_requests WHERE id = ${leaveId}`
        res.status(200).json({ status: 'deleted', leaveId })
        return
      }

      res.status(400).json({ error: 'slotId or leaveId required' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
