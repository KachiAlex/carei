import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors } from '../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const cookie = req.headers.cookie || ''
  const match = cookie.match(/carei_token=([^;]+)/)
  const token = match ? match[1] : ''

  if (token) {
    try {
      const sql = getSql()
      await sql`UPDATE users SET token = NULL WHERE token = ${token}`
    } catch {}
  }

  res.setHeader('Set-Cookie', 'carei_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
  res.status(200).json({ status: 'logged out' })
}
