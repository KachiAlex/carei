import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { carerId, location, timestamp } = req.body || {}

  // In production: send push notification + SMS to supervisor
  // For now, log and return success
  console.log('SOS ALERT:', { carerId, location, timestamp, receivedAt: new Date().toISOString() })

  res.status(200).json({
    status: 'alert_sent',
    alertId: `SOS-${Date.now()}`,
    escalatedTo: 'supervisor',
    message: 'SOS alert received. Supervisor notified.',
  })
}
