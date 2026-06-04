import type { VercelRequest, VercelResponse } from '@vercel/node'
import { broadcast } from './events'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { carerId, location, timestamp } = req.body || {}

  const alert = {
    type: 'sos',
    alertId: `SOS-${Date.now()}`,
    carerId,
    location,
    timestamp: timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  }

  // Broadcast to all connected SSE clients (manager dashboards)
  broadcast(alert)

  res.status(200).json({
    status: 'alert_sent',
    alertId: alert.alertId,
    escalatedTo: 'supervisor',
    message: 'SOS alert received. Supervisor notified.',
  })
}
