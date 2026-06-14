import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, checkRateLimit } from './db.js'

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Mock SMS sender — replace with Twilio/SendGrid in production
async function sendOtpSms(email: string, code: string): Promise<void> {
  console.log(`[MOCK SMS] To: ${email} | Code: ${code}`)
  // Example real implementation:
  // await twilioClient.messages.create({ body: `Your CAREi code: ${code}`, from: '+1234567890', to: phone })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const sql = getSql()

    if (req.method === 'POST') {
      const { action, email, code, purpose, userData } = req.body || {}

      if (action === 'send') {
        const limit = checkRateLimit(req, 'otp-send', 3, 60000)
        if (!limit.allowed) {
          res.status(429).json({ error: 'Too many OTP requests', retryAfter: limit.retryAfter })
          return
        }
        if (!email) {
          res.status(400).json({ error: 'Email required' })
          return
        }
        const otp = generateCode()
        const id = 'otp-' + Date.now()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min expiry

        await sql`
          INSERT INTO otp_codes (id, email, code, purpose, expires_at)
          VALUES (${id}, ${email.toLowerCase()}, ${otp}, ${purpose || 'login'}, ${expiresAt})
        `

        await sendOtpSms(email, otp)

        res.status(200).json({ status: 'sent', message: 'Check your messages for the code', demoCode: otp })
        return
      }

      if (action === 'verify') {
        if (!email || !code) {
          res.status(400).json({ error: 'Email and code required' })
          return
        }

        const rows = await sql`
          SELECT * FROM otp_codes
          WHERE email = ${email.toLowerCase()}
            AND code = ${code}
            AND used = FALSE
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1
        ` as any[]

        if (rows.length === 0) {
          res.status(400).json({ error: 'Invalid or expired code' })
          return
        }

        const otpRow = rows[0]
        await sql`UPDATE otp_codes SET used = TRUE WHERE id = ${otpRow.id}`

        // If this is a registration, create the user
        if (purpose === 'register' && userData) {
          const { id, name, phone, region, pin, role } = userData
          const token = 'tok-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)

          // Check if user already exists (case-insensitive)
          const existing = await sql`SELECT id FROM users WHERE LOWER(email) = ${email.toLowerCase()}` as any[]
          if (existing.length > 0) {
            res.status(409).json({ error: 'An account with this email already exists' })
            return
          }

          await sql`
            INSERT INTO users (id, name, email, phone, region, pin, role, token)
            VALUES (${id}, ${name}, ${email.toLowerCase()}, ${phone}, ${region}, ${pin}, ${role || 'carer'}, ${token})
          `
          res.status(200).json({ status: 'verified', token, user: { id, name, email: email.toLowerCase(), role: role || 'carer' } })
          return
        }

        // If this is a login, find the user and return token (case-insensitive)
        if (purpose === 'login') {
          const users = await sql`SELECT id, name, email, phone, region, role FROM users WHERE LOWER(email) = ${email.toLowerCase()}` as any[]
          if (users.length === 0) {
            res.status(404).json({ error: 'No account found with this email' })
            return
          }
          const user = users[0]
          const token = 'tok-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
          await sql`UPDATE users SET token = ${token} WHERE id = ${user.id}`
          res.status(200).json({ status: 'verified', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
          return
        }

        // If this is a PIN reset, just verify the OTP (PIN update handled by /auth/reset-pin)
        if (purpose === 'reset-pin') {
          // Just verify that the user exists
          const users = await sql`SELECT id FROM users WHERE LOWER(email) = ${email.toLowerCase()}` as any[]
          if (users.length === 0) {
            res.status(404).json({ error: 'No account found with this email' })
            return
          }
          res.status(200).json({ status: 'verified', valid: true, success: true, message: 'OTP verified for PIN reset' })
          return
        }

        res.status(400).json({ error: 'Unknown purpose' })
        return
      }

      res.status(400).json({ error: 'Unknown action' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
