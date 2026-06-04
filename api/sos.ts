import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { broadcast } from './events'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')
const sql = neon(connectionString)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { visitId, location, timestamp } = req.body || {}
  const alertId = `SOS-${Date.now()}`

  await sql`
    INSERT INTO sos_alerts (id, visit_id, location, timestamp)
    VALUES (${alertId}, ${visitId}, ${location}, ${timestamp || new Date().toISOString()})
  `

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
