import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getUserFromToken, getAuthToken } from '../db.js'

// Stores a native push registration token (FCM on Android, FCM-or-APNs on iOS)
// for the authenticated user. Upserts on (user_id, token).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await ensureTables()
    const token = getAuthToken(req)
    const sql = getSql()
    const user = token ? await getUserFromToken(sql, token) : null
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    const { token: pushToken, platform } = req.body || {}
    if (!pushToken || typeof pushToken !== 'string' || !platform) {
      res.status(400).json({ error: 'token and platform are required' })
      return
    }

    await sql`
      INSERT INTO push_tokens (user_id, token, platform)
      VALUES (${user.id}, ${pushToken}, ${platform})
      ON CONFLICT (user_id, token)
      DO UPDATE SET platform = ${platform}, updated_at = NOW()
    `
    res.status(200).json({ status: 'registered' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
