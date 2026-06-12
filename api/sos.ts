import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, checkRateLimit } from './db.js'
import { broadcast } from './events.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
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

  try {
    await ensureTables()
    const sql = getSql()
    await sql`
      INSERT INTO sos_alerts (id, visit_id, location, timestamp)
      VALUES (${alertId}, ${visitId}, ${location}, ${timestamp || new Date().toISOString()})
    `
  } catch (err: any) {
    res.status(500).json({ error: err.message })
    return
  }

  const alert = {
    type: 'sos',
    alertId,
    visitId,
    location,
    timestamp: timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  }

  broadcast(alert)

  res.status(200).json({
    status: 'alert_sent',
    alertId,
    escalatedTo: 'supervisor',
    message: 'SOS alert received. Supervisor notified.',
  })
}
