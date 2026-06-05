import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')
const sql = neon(connectionString)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const cookie = req.headers.cookie || ''
  const match = cookie.match(/carei_token=([^;]+)/)
  const token = match ? match[1] : ''

  if (token) {
    try {
      await sql`UPDATE users SET token = NULL WHERE token = ${token}`
    } catch {}
  }

  res.setHeader('Set-Cookie', 'carei_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
  res.status(200).json({ status: 'logged out' })
}
