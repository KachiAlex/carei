import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken } from '../db.js'
import crypto from 'crypto'

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' })
    return
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const rows = await sql`SELECT id, password_hash FROM users WHERE token = ${token} LIMIT 1` as any[]
    const user = rows[0]
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // If user has no password_hash, they registered with PIN only
    if (!user.password_hash) {
      res.status(400).json({ error: 'No password set. Use PIN login or set a password first.' })
      return
    }

    const hashedCurrent = hashPassword(currentPassword)
    if (user.password_hash !== hashedCurrent) {
      res.status(401).json({ error: 'Current password is incorrect' })
      return
    }

    const hashedNew = hashPassword(newPassword)
    await sql`UPDATE users SET password_hash = ${hashedNew} WHERE id = ${user.id}`

    res.status(200).json({ status: 'updated', message: 'Password changed successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
