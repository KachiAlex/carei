import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../_db'

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = req.body || {}
  const { email, pin } = body

  if (!email || !pin) {
    res.status(400).json({ error: 'email and pin are required' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const rows = await sql`
      SELECT id, name, email, phone, region, pin, role
      FROM users
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    ` as any[]

    const user = rows[0]
    if (!user || user.pin !== pin) {
      res.status(401).json({ error: 'Invalid email or PIN' })
      return
    }

    const token = generateToken()
    await sql`UPDATE users SET token = ${token} WHERE id = ${user.id}`

    res.setHeader('Set-Cookie', `carei_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        region: user.region,
        role: user.role,
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
