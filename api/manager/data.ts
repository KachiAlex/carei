import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken } from '../db.js'

async function safeQuery(sql: any, query: any, fallback: any[] = []) {
  try {
    return await query
  } catch (err: any) {
    if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
      return fallback
    }
    throw err
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }
    const isManager = user.role === 'manager' || user.role === 'admin'
    if (!isManager) {
      res.status(403).json({ error: 'Only managers can access this data' })
      return
    }

    const caregiverRows = await sql`SELECT id, name, email, phone, region, role, status, created_at FROM users WHERE role = 'carer' ORDER BY name` as any[]
    const carers = caregiverRows.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      avatar: u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      status: u.status || 'active',
      location: u.region || '—',
      client: '—',
      since: u.created_at ? new Date(u.created_at).toLocaleDateString() : '—',
    }))
    const visits = await safeQuery(sql, sql`SELECT * FROM visits ORDER BY submitted_at DESC LIMIT 50`)
    const alerts = await safeQuery(sql, sql`SELECT * FROM sos_alerts WHERE resolved = FALSE ORDER BY timestamp DESC LIMIT 20`)
    const incidents = await safeQuery(sql, sql`SELECT * FROM incidents WHERE resolved = FALSE ORDER BY timestamp DESC LIMIT 50`)
    const medications = await safeQuery(sql, sql`SELECT * FROM medication_logs WHERE DATE(timestamp) = CURRENT_DATE ORDER BY scheduled_time NULLS LAST LIMIT 100`)

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
