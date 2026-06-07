import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db.js'

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

  const { email, credentialId } = req.body || {}
  if (!email || !credentialId) {
    res.status(400).json({ error: 'email and credentialId required' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()

    const rows = await sql`
      SELECT id, name, email, phone, region, role, biometrics_enabled, webauthn_credential
      FROM users
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    ` as any[]

    const user = rows[0]
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    if (!user.biometrics_enabled) {
      res.status(403).json({ error: 'Biometrics not enabled for this account' })
      return
    }

    const storedCredential = user.webauthn_credential
    if (!storedCredential || storedCredential.id !== credentialId) {
      res.status(403).json({ error: 'Biometric credential mismatch' })
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
