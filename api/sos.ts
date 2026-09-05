import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, checkRateLimit, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from './db.js'
import { broadcast } from './events.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const limit = checkRateLimit(req, 'sos', 5, 60000)
  if (!limit.allowed) {
    res.status(429).json({ error: 'Too many SOS alerts', retryAfter: limit.retryAfter })
    return
  }

  const { visitId, location, timestamp } = req.body || {}
  if (!visitId) {
    res.status(400).json({ error: 'visitId required' })
    return
  }
  const alertId = `SOS-${Date.now()}`
  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, userId, sql: tenantSql }) => {
        // Verify the visit belongs to this caregiver in this tenant
        const visitRows = await tenantSql`
          SELECT id FROM visits
          WHERE id = ${visitId} AND tenant_id = ${tenantId}
          LIMIT 1
        ` as any[]
        if (visitRows.length === 0) {
          res.status(403).json({ error: 'Visit not found in this organization' })
          return
        }

        await tenantSql`
          INSERT INTO sos_alerts (id, tenant_id, visit_id, location, timestamp)
          VALUES (${alertId}, ${tenantId}, ${visitId}, ${location}, ${timestamp || new Date().toISOString()})
        `

        const alert = {
          type: 'sos', alertId, visitId, location,
          timestamp: timestamp || new Date().toISOString(),
          receivedAt: new Date().toISOString(),
        }
        broadcast(alert)

        res.status(200).json({
          status: 'alert_sent', alertId, escalatedTo: 'supervisor',
          message: 'SOS alert received. Supervisor notified.',
        })
      })
      return
    }

    // Legacy non-tenant handler
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    await sql`
      INSERT INTO sos_alerts (id, visit_id, location, timestamp)
      VALUES (${alertId}, ${visitId}, ${location}, ${timestamp || new Date().toISOString()})
    `

    const alert = {
      type: 'sos', alertId, visitId, location,
      timestamp: timestamp || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    }

    broadcast(alert)

    res.status(200).json({
      status: 'alert_sent', alertId, escalatedTo: 'supervisor',
      message: 'SOS alert received. Supervisor notified.',
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
