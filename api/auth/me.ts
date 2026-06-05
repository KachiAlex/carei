import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')
const sql = neon(connectionString)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '')

  if (!token) {
    res.status(401).json({ error: 'Missing token' })
    return
  }

  try {
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
