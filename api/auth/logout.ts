import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken } from '../db.js'

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
      const user = await getUserFromToken(sql, token)
      if (user) {
        await sql`
          UPDATE users
          SET token_hash = NULL, token_expires_at = NULL, token = NULL
          WHERE id = ${user.id}
        `
      }
    } catch {}
  }

  res.setHeader('Set-Cookie', 'carei_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
  res.status(200).json({ status: 'logged out' })
}
