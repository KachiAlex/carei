import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const carers = await sql`SELECT * FROM carers ORDER BY name`
    const visits = await sql`SELECT * FROM visits ORDER BY submitted_at DESC LIMIT 50`
    const alerts = await sql`SELECT * FROM sos_alerts WHERE resolved = FALSE ORDER BY timestamp DESC LIMIT 20`

    res.status(200).json({
      carers,
      visits,
      alerts,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
