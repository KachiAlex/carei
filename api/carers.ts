import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
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
    res.status(200).json({ carers })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
