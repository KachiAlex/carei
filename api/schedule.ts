import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

interface RecurringParent {
  id: string
  recurring: string
  visitDate: string
  recurrenceEndDate?: string | null
  [key: string]: any
}

interface ExpandedInstance {
  visitDate: string
}

function expandRecurring(parent: RecurringParent, from: string, to: string): ExpandedInstance[] {
  const instances: ExpandedInstance[] = []
  const startDate = new Date(parent.visitDate + 'T00:00:00')
  const endDate = parent.recurrenceEndDate
    ? new Date(parent.recurrenceEndDate + 'T00:00:00')
    : new Date(to + 'T00:00:00')
  const rangeStart = new Date(from + 'T00:00:00')
  const rangeEnd = new Date(to + 'T00:00:00')

  // Cap expansion at 365 days to prevent runaway loops
  const cap = new Date(startDate)
  cap.setDate(cap.getDate() + 365)
  const effectiveEnd = endDate < cap ? endDate : cap

  if (parent.recurring === 'daily') {
    const cursor = new Date(Math.max(startDate.getTime(), rangeStart.getTime()))
    while (cursor <= effectiveEnd && cursor <= rangeEnd) {
      instances.push({ visitDate: cursor.toISOString().split('T')[0] })
      cursor.setDate(cursor.getDate() + 1)
    }
  } else if (parent.recurring === 'weekly') {
    const cursor = new Date(Math.max(startDate.getTime(), rangeStart.getTime()))
    // Align cursor to the same weekday as the parent start date
    const parentDay = startDate.getDay()
    while (cursor.getDay() !== parentDay && cursor <= rangeEnd) {
      cursor.setDate(cursor.getDate() + 1)
    }
    while (cursor <= effectiveEnd && cursor <= rangeEnd) {
      instances.push({ visitDate: cursor.toISOString().split('T')[0] })
      cursor.setDate(cursor.getDate() + 7)
    }
  } else if (parent.recurring === 'monthly') {
    const parentDayOfMonth = startDate.getDate()
    const cursor = new Date(rangeStart)
    while (cursor <= rangeEnd) {
      // Set to the same day of month, clamping to end of month if needed
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
      const targetDay = Math.min(parentDayOfMonth, daysInMonth)
      if (targetDay >= cursor.getDate()) {
        const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), targetDay)
        if (candidate >= startDate && candidate <= effectiveEnd && candidate <= rangeEnd && candidate >= rangeStart) {
          instances.push({ visitDate: candidate.toISOString().split('T')[0] })
        }
      }
      // Move to next month
      cursor.setMonth(cursor.getMonth() + 1, 1)
    }
  }

  return instances
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  // If tenant slug provided, use tenant-aware filtering
  if (tenantSlug) {
    await withTenant(req, res, async ({ tenantId, sql }) => {
      if (req.method === 'GET') {
        const { from, to } = req.query as { from?: string; to?: string }
        let rows: any[]
        if (from && to) {
          // Fetch explicit visits in range
          rows = await sql`
            SELECT
              id,
              client_id AS "clientId",
              client_name AS "clientName",
              carer_id AS "carerId",
              carer_name AS "carerName",
              time,
              duration,
              status,
              tasks,
              flags,
              recurring,
              visit_date AS "visitDate",
              recurrence_end_date AS "recurrenceEndDate",
              recurrence_parent_id AS "recurrenceParentId"
            FROM scheduled_visits
            WHERE tenant_id = ${tenantId} AND visit_date BETWEEN ${from} AND ${to}
            ORDER BY visit_date, time
          ` as any[]

          // Fetch recurring parent visits that could expand into this range
          const recurringParents = await sql`
            SELECT
              id,
              client_id AS "clientId",
              client_name AS "clientName",
              carer_id AS "carerId",
              carer_name AS "carerName",
              time,
              duration,
              status,
              tasks,
              flags,
              recurring,
              visit_date AS "visitDate",
              recurrence_end_date AS "recurrenceEndDate"
            FROM scheduled_visits
            WHERE tenant_id = ${tenantId}
              AND recurring != 'none'
              AND visit_date <= ${to}
              AND (recurrence_end_date IS NULL OR recurrence_end_date >= ${from})
          ` as any[]

          // Expand recurring parents into individual instances within the range
          const existingIds = new Set(rows.map((r: any) => r.id))
          for (const parent of recurringParents) {
            const expanded = expandRecurring(parent, from, to)
            for (const instance of expanded) {
              // Skip if an explicit visit already exists for this date
              const instanceId = `${parent.id}_${instance.visitDate}`
              if (!existingIds.has(instanceId)) {
                rows.push({
                  ...parent,
                  id: instanceId,
                  visitDate: instance.visitDate,
                  recurring: parent.recurring,
                  recurrenceParentId: parent.id,
                  recurrenceEndDate: parent.recurrenceEndDate,
                })
              }
            }
          }

          // Sort combined results
          rows.sort((a: any, b: any) => {
            if (a.visitDate < b.visitDate) return -1
            if (a.visitDate > b.visitDate) return 1
            return (a.time || '').localeCompare(b.time || '')
          })
        } else {
          rows = await sql`
            SELECT
              id,
              client_id AS "clientId",
              client_name AS "clientName",
              carer_id AS "carerId",
              carer_name AS "carerName",
              time,
              duration,
              status,
              tasks,
              flags,
              recurring,
              visit_date AS "visitDate",
              recurrence_end_date AS "recurrenceEndDate",
              recurrence_parent_id AS "recurrenceParentId"
            FROM scheduled_visits
            WHERE tenant_id = ${tenantId}
            ORDER BY visit_date DESC, time
            LIMIT 100
          ` as any[]
        }
        res.status(200).json({ visits: rows })
        return
      }

      if (req.method === 'POST') {
        const body = req.body || {}
        const { id, clientId, clientName, carerId, carerName, time, duration, tasks, flags, recurring, visitDate, recurrenceEndDate } = body
        if (!id || !clientName || !visitDate) {
          res.status(400).json({ error: 'id, clientName, and visitDate required' })
          return
        }
        await sql`
          INSERT INTO scheduled_visits (
            id, tenant_id, client_id, client_name, carer_id, carer_name,
            time, duration, tasks, flags, recurring, visit_date, recurrence_end_date
          ) VALUES (
            ${id}, ${tenantId}, ${clientId || null}, ${clientName}, ${carerId || null}, ${carerName || null},
            ${time || null}, ${duration || null}, ${JSON.stringify(tasks || [])}, ${JSON.stringify(flags || [])}, ${recurring || 'none'}, ${visitDate}, ${recurrenceEndDate || null}
          )
        `
        res.status(201).json({ status: 'created', id })
        return
      }

      if (req.method === 'PATCH' || req.method === 'PUT') {
        const { id } = req.query as { id?: string }
        if (!id) {
          res.status(400).json({ error: 'id required' })
          return
        }
        const body = req.body || {}
        const { carerId, carerName, time, status, tasks } = body
        await sql`
          UPDATE scheduled_visits SET
            carer_id = COALESCE(${carerId || null}, carer_id),
            carer_name = COALESCE(${carerName || null}, carer_name),
            time = COALESCE(${time || null}, time),
            status = COALESCE(${status || null}, status),
            tasks = COALESCE(${JSON.stringify(tasks || null)}, tasks)
          WHERE id = ${id} AND tenant_id = ${tenantId}
        `
        res.status(200).json({ status: 'updated', id })
        return
      }

      if (req.method === 'DELETE') {
        const { id } = req.query as { id?: string }
        if (!id) {
          res.status(400).json({ error: 'id required' })
          return
        }
        await sql`DELETE FROM scheduled_visits WHERE id = ${id} AND tenant_id = ${tenantId}`
        res.status(200).json({ status: 'deleted', id })
        return
      }

      res.status(405).json({ error: 'Method not allowed' })
    })
    return
  }

  // Legacy non-tenant handler
  if (req.method === 'GET') {
    const { from, to } = req.query as { from?: string; to?: string }
    try {
      await ensureTables()
      const sql = getSql()
      let rows
      if (from && to) {
        rows = await sql`
          SELECT
            id,
            client_id AS "clientId",
            client_name AS "clientName",
            carer_id AS "carerId",
            carer_name AS "carerName",
            time,
            duration,
            status,
            tasks,
            flags,
            recurring,
            visit_date AS "visitDate"
          FROM scheduled_visits
          WHERE visit_date BETWEEN ${from} AND ${to}
          ORDER BY visit_date, time
        `
      } else {
        rows = await sql`
          SELECT
            id,
            client_id AS "clientId",
            client_name AS "clientName",
            carer_id AS "carerId",
            carer_name AS "carerName",
            time,
            duration,
            status,
            tasks,
            flags,
            recurring,
            visit_date AS "visitDate"
          FROM scheduled_visits
          ORDER BY visit_date DESC, time
          LIMIT 100
        `
      }
      res.status(200).json({ visits: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const { id, clientId, clientName, carerId, carerName, time, duration, tasks, flags, recurring, visitDate } = body
    if (!id || !clientName || !visitDate) {
      res.status(400).json({ error: 'id, clientName, and visitDate required' })
      return
    }
    try {
      await ensureTables()
      const sql = getSql()
      await sql`
        INSERT INTO scheduled_visits (
          id, client_id, client_name, carer_id, carer_name,
          time, duration, tasks, flags, recurring, visit_date
        ) VALUES (
          ${id}, ${clientId || null}, ${clientName}, ${carerId || null}, ${carerName || null},
          ${time || null}, ${duration || null}, ${JSON.stringify(tasks || [])}, ${JSON.stringify(flags || [])}, ${recurring || 'none'}, ${visitDate}
        )
      `
      res.status(201).json({ status: 'created', id })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  const { id: queryId } = req.query as { id?: string }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    if (!queryId) {
      res.status(400).json({ error: 'id required' })
      return
    }
    const body = req.body || {}
    const { clientId, clientName, carerId, carerName, time, duration, status, tasks, flags, recurring, visitDate } = body
    try {
      await ensureTables()
      const sql = getSql()
      await sql`
        UPDATE scheduled_visits SET
          client_id = COALESCE(${clientId || null}, client_id),
          client_name = COALESCE(${clientName || null}, client_name),
          carer_id = COALESCE(${carerId || null}, carer_id),
          carer_name = COALESCE(${carerName || null}, carer_name),
          time = COALESCE(${time || null}, time),
          duration = COALESCE(${duration || null}, duration),
          status = COALESCE(${status || null}, status),
          tasks = COALESCE(${JSON.stringify(tasks || null)}, tasks),
          flags = COALESCE(${JSON.stringify(flags || null)}, flags),
          recurring = COALESCE(${recurring || null}, recurring),
          visit_date = COALESCE(${visitDate || null}, visit_date)
        WHERE id = ${queryId}
      `
      res.status(200).json({ status: 'updated', id: queryId })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'DELETE') {
    if (!queryId) {
      res.status(400).json({ error: 'id required' })
      return
    }
    try {
      await ensureTables()
      const sql = getSql()
      await sql`DELETE FROM scheduled_visits WHERE id = ${queryId}`
      res.status(200).json({ status: 'deleted', id: queryId })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
