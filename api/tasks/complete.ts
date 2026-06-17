import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, withTenant, getTenantSlug } from '../db.js'

async function getUserFromToken(sql: any, token: string) {
  const rows = await sql`SELECT id, name, role FROM users WHERE token = ${token} LIMIT 1` as any[]
  return rows[0] || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { logId, notes } = req.body || {}
  if (!logId) {
    res.status(400).json({ error: 'logId required' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        // Get the log to calculate duration (tenant-scoped via task_logs.tenant_id)
        const logs = await tenantSql`
          SELECT start_time FROM task_logs WHERE id = ${logId} AND caregiver_id = ${user.id} AND tenant_id = ${tenantId}
          LIMIT 1
        ` as any[]
        if (logs.length === 0) {
          res.status(404).json({ error: 'Task log not found' })
          return
        }

        const startTime = new Date(logs[0].start_time)
        const completeTime = new Date()
        const durationMinutes = Math.round((completeTime.getTime() - startTime.getTime()) / 60000)

        await tenantSql`
          UPDATE task_logs
          SET complete_time = ${completeTime.toISOString()},
              notes = ${notes || null},
              duration_minutes = ${durationMinutes}
          WHERE id = ${logId} AND caregiver_id = ${user.id} AND tenant_id = ${tenantId}
        `

        res.status(200).json({
          status: 'completed',
          logId,
          durationMinutes,
          completeTime: completeTime.toISOString(),
        })
      })
      return
    }

    // Legacy non-tenant handler
    // Get the log to calculate duration
    const logs = await sql`
      SELECT start_time FROM task_logs WHERE id = ${logId} AND caregiver_id = ${user.id}
      LIMIT 1
    ` as any[]
    if (logs.length === 0) {
      res.status(404).json({ error: 'Task log not found' })
      return
    }

    const startTime = new Date(logs[0].start_time)
    const completeTime = new Date()
    const durationMinutes = Math.round((completeTime.getTime() - startTime.getTime()) / 60000)

    await sql`
      UPDATE task_logs
      SET complete_time = ${completeTime.toISOString()},
          notes = ${notes || null},
          duration_minutes = ${durationMinutes}
      WHERE id = ${logId} AND caregiver_id = ${user.id}
    `

    res.status(200).json({
      status: 'completed',
      logId,
      durationMinutes,
      completeTime: completeTime.toISOString(),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
