import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const secret = req.headers['x-cleanup-secret']
  if (secret !== 'carei-cleanup-2026') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const before = await sql`SELECT id, email, name, role FROM users ORDER BY email`
    const deleted = await sql`DELETE FROM users WHERE email <> 'admin@carei.com' RETURNING email`
    const after = await sql`SELECT id, email, name, role FROM users ORDER BY email`
    res.status(200).json({ before, deleted, after })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
