import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db.js'

async function getUserFromToken(sql: any, token: string) {
  const rows = await sql`SELECT id, name, role, biometrics_enabled, webauthn_credential FROM users WHERE token = ${token} LIMIT 1` as any[]
  return rows[0] || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const cookie = req.headers.cookie || ''
  const match = cookie.match(/carei_token=([^;]+)/)
  const token = match ? match[1] : ''
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    if (req.method === 'GET') {
      res.status(200).json({
        enabled: user.biometrics_enabled || false,
        hasCredential: !!user.webauthn_credential,
      })
      return
    }

    if (req.method === 'POST') {
      const { credential, enabled } = req.body || {}
      await sql`
        UPDATE users
        SET biometrics_enabled = ${enabled === true},
            webauthn_credential = ${credential ? JSON.stringify(credential) : user.webauthn_credential}
        WHERE id = ${user.id}
      `
      res.status(200).json({ status: 'updated', biometricsEnabled: enabled === true })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
