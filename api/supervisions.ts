import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug, getAuthToken, getUserFromToken } from './db.js'

const MEETING_TYPES = ['supervision', 'appraisal', '1:1', 'team meeting', 'probation review']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // ---- GET ----
    if (req.method === 'GET') {
      const { carerId, fromDate, toDate, status, upcoming } = req.query as {
        carerId?: string
        fromDate?: string
        toDate?: string
        status?: string
        upcoming?: string
      }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          let rows
          if (upcoming === 'true') {
            const today = new Date().toISOString().split('T')[0]
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                manager_id AS "managerId", manager_name AS "managerName",
                type, scheduled_date AS "scheduledDate", scheduled_time AS "scheduledTime",
                duration_minutes AS "durationMinutes", location, status,
                agenda, notes, action_items AS "actionItems", rating,
                completed_at AS "completedAt", created_at AS "createdAt"
              FROM supervisions
              WHERE tenant_id = ${tenantId}
                AND scheduled_date >= ${today}
                AND status IN ('scheduled', 'rescheduled')
              ORDER BY scheduled_date, scheduled_time
              LIMIT 50
            ` as any[]
          } else if (carerId && fromDate && toDate) {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                manager_id AS "managerId", manager_name AS "managerName",
                type, scheduled_date AS "scheduledDate", scheduled_time AS "scheduledTime",
                duration_minutes AS "durationMinutes", location, status,
                agenda, notes, action_items AS "actionItems", rating,
                completed_at AS "completedAt", created_at AS "createdAt"
              FROM supervisions
              WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
                AND scheduled_date >= ${fromDate} AND scheduled_date <= ${toDate}
              ORDER BY scheduled_date DESC, scheduled_time
            ` as any[]
          } else if (carerId) {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                manager_id AS "managerId", manager_name AS "managerName",
                type, scheduled_date AS "scheduledDate", scheduled_time AS "scheduledTime",
                duration_minutes AS "durationMinutes", location, status,
                agenda, notes, action_items AS "actionItems", rating,
                completed_at AS "completedAt", created_at AS "createdAt"
              FROM supervisions
              WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
              ORDER BY scheduled_date DESC, scheduled_time
              LIMIT 100
            ` as any[]
          } else if (status) {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                manager_id AS "managerId", manager_name AS "managerName",
                type, scheduled_date AS "scheduledDate", scheduled_time AS "scheduledTime",
                duration_minutes AS "durationMinutes", location, status,
                agenda, notes, action_items AS "actionItems", rating,
                completed_at AS "completedAt", created_at AS "createdAt"
              FROM supervisions
              WHERE tenant_id = ${tenantId} AND status = ${status}
              ORDER BY scheduled_date DESC, scheduled_time
              LIMIT 100
            ` as any[]
          } else {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", carer_name AS "carerName",
                manager_id AS "managerId", manager_name AS "managerName",
                type, scheduled_date AS "scheduledDate", scheduled_time AS "scheduledTime",
                duration_minutes AS "durationMinutes", location, status,
                agenda, notes, action_items AS "actionItems", rating,
                completed_at AS "completedAt", created_at AS "createdAt"
              FROM supervisions
              WHERE tenant_id = ${tenantId}
              ORDER BY scheduled_date DESC, scheduled_time
              LIMIT 200
            ` as any[]
          }

          // Summary counts
          const today = new Date().toISOString().split('T')[0]
          const upcomingCount = (rows as any[]).filter((r) => r.scheduledDate >= today && (r.status === 'scheduled' || r.status === 'rescheduled')).length
          const completedCount = (rows as any[]).filter((r) => r.status === 'completed').length
          const cancelledCount = (rows as any[]).filter((r) => r.status === 'cancelled').length

          res.status(200).json({
            meetings: rows,
            summary: { total: rows.length, upcoming: upcomingCount, completed: completedCount, cancelled: cancelledCount },
          })
        })
        return
      }
      res.status(200).json({ meetings: [], summary: { total: 0, upcoming: 0, completed: 0, cancelled: 0 } })
      return
    }

    // ---- POST: Create, update, or complete ----
    if (req.method === 'POST') {
      const body = req.body || {}
      const { action } = body

      // Complete a meeting (add notes, action items, rating)
      if (action === 'complete') {
        const { id, notes, actionItems, rating } = body
        if (!id) { res.status(400).json({ error: 'id required' }); return }

        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            await tenantSql`
              UPDATE supervisions SET
                status = 'completed',
                notes = ${notes || null},
                action_items = ${JSON.stringify(actionItems || [])},
                rating = ${rating || null},
                completed_at = NOW(),
                updated_at = NOW()
              WHERE id = ${id} AND tenant_id = ${tenantId}
            `
            res.status(200).json({ status: 'completed', id })
          })
          return
        }
        await sql`
          UPDATE supervisions SET
            status = 'completed',
            notes = ${notes || null},
            action_items = ${JSON.stringify(actionItems || [])},
            rating = ${rating || null},
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
        `
        res.status(200).json({ status: 'completed', id })
        return
      }

      // Cancel a meeting
      if (action === 'cancel') {
        const { id } = body
        if (!id) { res.status(400).json({ error: 'id required' }); return }

        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            await tenantSql`
              UPDATE supervisions SET status = 'cancelled', updated_at = NOW()
              WHERE id = ${id} AND tenant_id = ${tenantId}
            `
            res.status(200).json({ status: 'cancelled', id })
          })
          return
        }
        await sql`UPDATE supervisions SET status = 'cancelled', updated_at = NOW() WHERE id = ${id}`
        res.status(200).json({ status: 'cancelled', id })
        return
      }

      // Create or update a meeting
      const {
        id, carerId, carerName, managerId, managerName,
        type, scheduledDate, scheduledTime, durationMinutes,
        location, agenda, notes,
      } = body

      if (!carerId || !scheduledDate) {
        res.status(400).json({ error: 'carerId and scheduledDate required' })
        return
      }

      const recordId = id || 'sup_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)

      // Try to get current user for manager name
      const token = getAuthToken(req)
      const user = token ? await getUserFromToken(sql, token) : null
      const mgrName = managerName || user?.name || null
      const mgrId = managerId || user?.id || null

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          await tenantSql`
            INSERT INTO supervisions (
              id, tenant_id, carer_id, carer_name, manager_id, manager_name,
              type, scheduled_date, scheduled_time, duration_minutes,
              location, status, agenda, notes, updated_at
            ) VALUES (
              ${recordId}, ${tenantId}, ${carerId}, ${carerName || null},
              ${mgrId}, ${mgrName},
              ${type || 'supervision'}, ${scheduledDate}, ${scheduledTime || null},
              ${durationMinutes || 60}, ${location || null},
              'scheduled', ${agenda || null}, ${notes || null}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              carer_name = EXCLUDED.carer_name,
              manager_id = EXCLUDED.manager_id,
              manager_name = EXCLUDED.manager_name,
              type = EXCLUDED.type,
              scheduled_date = EXCLUDED.scheduled_date,
              scheduled_time = EXCLUDED.scheduled_time,
              duration_minutes = EXCLUDED.duration_minutes,
              location = EXCLUDED.location,
              agenda = EXCLUDED.agenda,
              notes = EXCLUDED.notes,
              updated_at = NOW()
          `
          res.status(200).json({ status: 'saved', id: recordId })
        })
        return
      }
      await sql`
        INSERT INTO supervisions (
          id, carer_id, carer_name, manager_id, manager_name,
          type, scheduled_date, scheduled_time, duration_minutes,
          location, status, agenda, notes, updated_at
        ) VALUES (
          ${recordId}, ${carerId}, ${carerName || null},
          ${mgrId}, ${mgrName},
          ${type || 'supervision'}, ${scheduledDate}, ${scheduledTime || null},
          ${durationMinutes || 60}, ${location || null},
          'scheduled', ${agenda || null}, ${notes || null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          carer_name = EXCLUDED.carer_name,
          manager_id = EXCLUDED.manager_id,
          manager_name = EXCLUDED.manager_name,
          type = EXCLUDED.type,
          scheduled_date = EXCLUDED.scheduled_date,
          scheduled_time = EXCLUDED.scheduled_time,
          duration_minutes = EXCLUDED.duration_minutes,
          location = EXCLUDED.location,
          agenda = EXCLUDED.agenda,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `
      res.status(200).json({ status: 'saved', id: recordId })
      return
    }

    // ---- DELETE ----
    if (req.method === 'DELETE') {
      const { id } = req.query as { id?: string }
      if (!id) { res.status(400).json({ error: 'id required' }); return }
      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          await tenantSql`DELETE FROM supervisions WHERE id = ${id} AND tenant_id = ${tenantId}`
          res.status(200).json({ status: 'deleted', id })
        })
        return
      }
      await sql`DELETE FROM supervisions WHERE id = ${id}`
      res.status(200).json({ status: 'deleted', id })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
