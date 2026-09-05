import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
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
    const userRows = await sql`SELECT id, name, role, biometrics_enabled, webauthn_credential FROM users WHERE id = ${baseUser.id} LIMIT 1` as any[]
    const user = userRows[0]
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
