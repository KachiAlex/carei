import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken } from './db.js'

function generateId(): string {
  return 'vm-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

async function getUserFromToken(sql: any, token: string) {
  const rows = await sql`SELECT id, name, role FROM users WHERE token = ${token} LIMIT 1` as any[]
  return rows[0] || null
}

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
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    if (req.method === 'POST') {
      const { visitId, clientId, audioUrl, duration } = req.body || {}
      if (!audioUrl || typeof audioUrl !== 'string' || audioUrl.length < 10) {
        res.status(400).json({ error: 'audioUrl required and must be a valid string' })
        return
      }
      // Reject if base64 payload exceeds ~2MB (≈1.5MB actual audio)
      if (audioUrl.length > 2_000_000) {
        res.status(413).json({ error: 'Audio file too large. Max ~2MB base64.' })
        return
      }
      const id = generateId()
      await sql`
        INSERT INTO voice_memos (id, visit_id, carer_id, client_id, audio_url, duration, created_at)
        VALUES (
          ${id}, ${visitId || null}, ${user.id}, ${clientId || null},
          ${audioUrl || null}, ${duration || null}, NOW()
        )
      `
      res.status(201).json({ status: 'saved', id })
      return
    }

    if (req.method === 'GET') {
      const { visitId } = req.query as { visitId?: string }
      if (visitId) {
        const rows = await sql`
          SELECT id, visit_id AS "visitId", carer_id AS "carerId", client_id AS "clientId",
                 audio_url AS "audioUrl", duration, created_at AS "createdAt"
          FROM voice_memos
          WHERE visit_id = ${visitId}
          ORDER BY created_at DESC
        ` as any[]
        res.status(200).json({ memos: rows })
        return
      }

      const rows = await sql`
        SELECT id, visit_id AS "visitId", carer_id AS "carerId", client_id AS "clientId",
               audio_url AS "audioUrl", duration, created_at AS "createdAt"
        FROM voice_memos
        WHERE carer_id = ${user.id}
        ORDER BY created_at DESC
        LIMIT 50
      ` as any[]
      res.status(200).json({ memos: rows })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
