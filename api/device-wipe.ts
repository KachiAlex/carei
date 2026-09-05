import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // ---- GET: Client checks for pending wipe, or manager lists all commands ----
    if (req.method === 'GET') {
      const { deviceId } = req.query as { deviceId?: string }

      // No deviceId → return list of all wipe commands (manager view)
      if (!deviceId) {
        if (tenantSlug) {
          await withTenant(req, res, async ({ sql: tenantSql }) => {
            const rows = await tenantSql`
              SELECT id, device_id, user_id, issued_by, reason, status, created_at, executed_at
              FROM device_wipe_commands
              ORDER BY created_at DESC
              LIMIT 50
            `
            res.status(200).json({ commands: rows })
          })
          return
        }
        const rows = await sql`
          SELECT id, device_id, user_id, issued_by, reason, status, created_at, executed_at
          FROM device_wipe_commands
          ORDER BY created_at DESC
          LIMIT 50
        `
        res.status(200).json({ commands: rows })
        return
      }

      // deviceId provided → check for pending wipe command
      if (tenantSlug) {
        await withTenant(req, res, async ({ sql: tenantSql }) => {
          const rows = await tenantSql`
            SELECT id, reason, created_at
            FROM device_wipe_commands
            WHERE device_id = ${deviceId} AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
          ` as any[]
          if (rows[0]) {
            res.status(200).json({ wipePending: true, reason: rows[0].reason, commandId: rows[0].id })
          } else {
            res.status(200).json({ wipePending: false })
          }
        })
        return
      }

      const rows = await sql`
        SELECT id, reason, created_at
        FROM device_wipe_commands
        WHERE device_id = ${deviceId} AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      ` as any[]
      if (rows[0]) {
        res.status(200).json({ wipePending: true, reason: rows[0].reason, commandId: rows[0].id })
      } else {
        res.status(200).json({ wipePending: false })
      }
      return
    }

    // ---- POST: Manager issues a wipe command OR client acknowledges ----
    if (req.method === 'POST') {
      const body = req.body || {}
      
      // Acknowledge wipe execution
      if (body.action === 'acknowledge' && body.commandId) {
        const { commandId } = body
        if (tenantSlug) {
          await withTenant(req, res, async ({ sql: tenantSql }) => {
            await tenantSql`
              UPDATE device_wipe_commands
              SET status = 'executed', executed_at = NOW()
              WHERE id = ${commandId}
            `
            res.status(200).json({ status: 'acknowledged', commandId })
          })
          return
        }
        await sql`
          UPDATE device_wipe_commands
          SET status = 'executed', executed_at = NOW()
          WHERE id = ${commandId}
        `
        res.status(200).json({ status: 'acknowledged', commandId })
        return
      }

      // Issue a new wipe command
      const { deviceId, userId, issuedBy, reason } = body
      if (!deviceId) {
        res.status(400).json({ error: 'deviceId required' })
        return
      }
      const commandId = 'wipe_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          await tenantSql`
            INSERT INTO device_wipe_commands (id, tenant_id, device_id, user_id, issued_by, reason)
            VALUES (${commandId}, ${tenantId}, ${deviceId}, ${userId || null}, ${issuedBy || null}, ${reason || 'Remote wipe issued by manager'})
          `
          res.status(201).json({ status: 'issued', commandId, deviceId })
        })
        return
      }

      await sql`
        INSERT INTO device_wipe_commands (id, device_id, user_id, issued_by, reason)
        VALUES (${commandId}, ${deviceId}, ${userId || null}, ${issuedBy || null}, ${reason || 'Remote wipe issued by manager'})
      `
      res.status(201).json({ status: 'issued', commandId, deviceId })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
