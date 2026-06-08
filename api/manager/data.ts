import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const caregiverRows = await sql`SELECT id, name, email, phone, region, role FROM users WHERE role = 'carer' ORDER BY name` as any[]
    // Map users to carer format with sensible defaults
    const carers = caregiverRows.map((u: any) => ({
      id: u.id,
      name: u.name,
      avatar: u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      status: 'available',
      location: u.region || '—',
      client: '—',
      since: '—',
    }))
    const visits = await sql`SELECT * FROM visits ORDER BY submitted_at DESC LIMIT 50`
    const alerts = await sql`SELECT * FROM sos_alerts WHERE resolved = FALSE ORDER BY timestamp DESC LIMIT 20`
    const incidents = await sql`SELECT * FROM incidents WHERE resolved = FALSE ORDER BY timestamp DESC LIMIT 50`
    const medications = await sql`SELECT * FROM medication_logs WHERE DATE(timestamp) = CURRENT_DATE ORDER BY scheduled_time NULLS LAST LIMIT 100`

    res.status(200).json({
      carers,
      visits,
      alerts,
      incidents,
      medications,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
