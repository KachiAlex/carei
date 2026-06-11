import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)

  if (token) {
    try {
      await ensureTables()
      const sql = getSql()
      await sql`UPDATE users SET token = NULL WHERE token = ${token}`
    } catch {}
  }

  res.setHeader('Set-Cookie', 'carei_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
  res.status(200).json({ status: 'logged out' })
}
