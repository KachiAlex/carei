import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const cookie = req.headers.cookie || ''
  const match = cookie.match(/carei_token=([^;]+)/)
  const token = match ? match[1] : ''

  if (!token) {
    res.status(401).json({ error: 'Missing token' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const rows = await sql`
      SELECT id, name, email, phone, region, role
      FROM users
      WHERE token = ${token}
      LIMIT 1
    ` as any[]

    const user = rows[0]
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    res.status(200).json({ user })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
