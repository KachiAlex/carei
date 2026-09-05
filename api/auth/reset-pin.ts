import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, checkRateLimit } from '../db.js'
import { hashCredential, generateSecureToken, hashToken } from '../hash.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const sql = getSql()

    if (req.method === 'POST') {
      const limit = checkRateLimit(req, 'reset-pin', 5, 60000)
      if (!limit.allowed) {
        res.status(429).json({ error: 'Too many reset attempts', retryAfter: limit.retryAfter })
        return
      }

      const { email, newPin, otp } = req.body || {}

      // Validate input
      if (!email || !newPin || !otp) {
        res.status(400).json({ error: 'Email, new PIN, and OTP code are required' })
        return
      }

      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        res.status(400).json({ error: 'PIN must be exactly 4 digits' })
        return
      }

      // Verify the OTP first
      const otpRows = await sql`
        SELECT * FROM otp_codes
        WHERE email = ${email.toLowerCase()}
          AND code = ${otp}
          AND used = FALSE
          AND expires_at > NOW()
          AND purpose = 'reset-pin'
        ORDER BY created_at DESC
        LIMIT 1
      ` as any[]

      if (otpRows.length === 0) {
        res.status(400).json({ error: 'Invalid or expired OTP code' })
        return
      }

      const otpRow = otpRows[0]

      // Mark OTP as used
      await sql`UPDATE otp_codes SET used = TRUE WHERE id = ${otpRow.id}`

      // Check if user exists
      const users = await sql`SELECT id, name, email, role FROM users WHERE LOWER(email) = ${email.toLowerCase()}` as any[]
      if (users.length === 0) {
        res.status(404).json({ error: 'No account found with this email' })
        return
      }

      const user = users[0]

      // Hash and update the user's PIN (clear plaintext pin)
      const pinHash = await hashCredential(newPin)
      await sql`UPDATE users SET pin = NULL, pin_hash = ${pinHash} WHERE id = ${user.id}`

      // Generate secure token
      const token = generateSecureToken()
      const tokenHash = await hashToken(token)
      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      await sql`UPDATE users SET token_hash = ${tokenHash}, token_expires_at = ${tokenExpiresAt}, token = NULL WHERE id = ${user.id}`

      console.log(`[PIN Reset] User ${email} PIN updated successfully`)

      res.status(200).json({
        success: true,
        message: 'PIN reset successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[PIN Reset Error]', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
