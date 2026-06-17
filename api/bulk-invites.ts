import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, verifyTenantAccess } from './db.js'
import { sendEmail } from './email.js'

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    const next = csv[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(cell.trim())
        cell = ''
      } else if (char === '\n' || char === '\r') {
        if (cell !== '' || row.length > 0) {
          row.push(cell.trim())
          rows.push(row)
        }
        row = []
        cell = ''
        if (char === '\r' && next === '\n') i++
      } else {
        cell += char
      }
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell.trim())
    rows.push(row)
  }

  return rows
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

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
    if (!token) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    let userId: string
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      userId = payload.userId
      if (!userId) throw new Error()
    } catch {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    const { tenantId, csv, expiresInHours = 48 } = req.body || {}

    if (!tenantId || !csv || typeof csv !== 'string') {
      res.status(400).json({ error: 'tenantId and csv are required' })
      return
    }

    const access = await verifyTenantAccess(userId, tenantId)
    if (!access.hasAccess || access.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can bulk create invites' })
      return
    }

    const sql = getSql()
    const rows = parseCSV(csv)
    if (rows.length === 0) {
      res.status(400).json({ error: 'CSV is empty' })
      return
    }

    // Determine columns from header
    const header = rows[0].map((h) => h.toLowerCase())
    const emailIdx = header.indexOf('email')
    const roleIdx = header.indexOf('role')

    if (emailIdx === -1) {
      res.status(400).json({ error: 'CSV must have an "email" column' })
      return
    }

    const tenantRows = await sql`SELECT name FROM tenants WHERE id = ${tenantId}`
    const tenantName = (tenantRows[0] as any)?.name || 'your organization'

    const results = {
      total: rows.length - 1,
      created: 0,
      failed: 0,
      errors: [] as Array<{ row: number; email: string; error: string }>,
    }

    const inviteUrlBase = process.env.FRONTEND_URL || 'https://carei.com'

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const email = row[emailIdx]?.trim()
      const role = roleIdx !== -1 ? (row[roleIdx]?.trim() || 'carer') : 'carer'

      if (!email) {
        results.failed++
        results.errors.push({ row: i, email: '', error: 'Missing email' })
        continue
      }

      if (!isValidEmail(email)) {
        results.failed++
        results.errors.push({ row: i, email, error: 'Invalid email format' })
        continue
      }

      try {
        const code = generateInviteCode()
        const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${i}`
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()

        await sql`
          INSERT INTO invites (id, tenant_id, code, email, role, created_by, expires_at, used)
          VALUES (${id}, ${tenantId}, ${code}, ${email}, ${role}, ${userId}, ${expiresAt}, FALSE)
        `

        const inviteUrl = `${inviteUrlBase}/join?code=${code}`
        sendEmail({
          to: email,
          subject: `You've been invited to join ${tenantName} on CAREi`,
          html: `<p>You have been invited to join <strong>${tenantName}</strong> on CAREi.</p>
                 <p><a href="${inviteUrl}">Accept Invite</a></p>
                 <p>Or copy this link: ${inviteUrl}</p>`,
        }).catch((err) => console.error('Bulk invite email failed:', err))

        results.created++
      } catch (err: any) {
        results.failed++
        results.errors.push({ row: i, email, error: err.message || 'Database error' })
      }
    }

    res.status(200).json(results)
  } catch (err: any) {
    console.error('Bulk invites API error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
