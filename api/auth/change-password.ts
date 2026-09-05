import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken } from '../db.js'
import crypto from 'crypto'
import { hashCredential, verifyCredential } from '../hash.js'

function legacyHashPassword(password: string): string {
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
    const baseUser = await getUserFromToken(sql, token)
    if (!baseUser) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }
    const rows = await sql`SELECT id, password_hash, password_hash_scrypt FROM users WHERE id = ${baseUser.id} LIMIT 1` as any[]
    const user = rows[0]
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // Verify current password
    let currentValid = false
    if (user.password_hash_scrypt) {
      currentValid = await verifyCredential(currentPassword, user.password_hash_scrypt)
    } else if (user.password_hash) {
      currentValid = user.password_hash === legacyHashPassword(currentPassword)
    }
    if (!currentValid) {
      res.status(401).json({ error: 'Current password is incorrect' })
      return
    }

    // Store new password with scrypt
    const hashedNew = await hashCredential(newPassword)
    await sql`UPDATE users SET password_hash_scrypt = ${hashedNew}, password_hash = NULL WHERE id = ${user.id}`

    res.status(200).json({ status: 'updated', message: 'Password changed successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
