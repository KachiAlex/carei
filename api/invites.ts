import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getAuthToken, getTenantFromSlug, verifyTenantAccess, addUserToTenant } from './db.js'
import { sendEmail } from './email.js'

// Generate a secure random code
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()

    // POST /api/invites - Create a new invite (admin only)
    if (req.method === 'POST') {
      const token = getAuthToken(req)
      if (!token) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      // Decode token
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      const userId = payload.userId

      if (!userId) {
        res.status(401).json({ error: 'Invalid token' })
        return
      }

      const { tenantId, email, role = 'carer', expiresInHours = 48 } = req.body || {}

      if (!tenantId || !email) {
        res.status(400).json({ error: 'tenantId and email are required' })
        return
      }

      // Verify user is admin of this tenant
      const access = await verifyTenantAccess(userId, tenantId)
      if (!access.hasAccess || access.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can create invites' })
        return
      }

      const sql = getSql()
      const code = generateInviteCode()
      const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()

      await sql`
        INSERT INTO invites (id, tenant_id, code, email, role, created_by, expires_at, used)
        VALUES (${id}, ${tenantId}, ${code}, ${email}, ${role}, ${userId}, ${expiresAt}, FALSE)
      `

      const inviteUrl = `${process.env.FRONTEND_URL || 'https://carei.com'}/join?code=${code}`

      // Fire-and-forget email send (don't block response)
      const tenantRows = await sql`SELECT name FROM tenants WHERE id = ${tenantId}`
      const tenantName = (tenantRows[0] as any)?.name || 'your organization'
      sendEmail({
        to: email,
        subject: `You've been invited to join ${tenantName} on CAREi`,
        html: `<p>You have been invited to join <strong>${tenantName}</strong> on CAREi.</p>
               <p><a href="${inviteUrl}">Accept Invite</a></p>
               <p>Or copy this link: ${inviteUrl}</p>`,
      }).catch((err) => console.error('Invite email failed:', err))

      res.status(201).json({
        id,
        code,
        email,
        role,
        expiresAt,
        inviteUrl,
      })
      return
    }

    // GET /api/invites?code=XXX - Verify an invite code
    if (req.method === 'GET') {
      const { code, tenantSlug } = req.query as { code?: string; tenantSlug?: string }

      // If verifying a specific invite code
      if (code) {
        const sql = getSql()
        const rows = await sql`
          SELECT i.*, t.slug as tenant_slug, t.name as tenant_name
          FROM invites i
          JOIN tenants t ON t.id = i.tenant_id
          WHERE i.code = ${code}
          LIMIT 1
        `

        if (!rows[0]) {
          res.status(404).json({ error: 'Invalid invite code' })
          return
        }

        const invite = rows[0] as any

        // Check if expired
        if (new Date(invite.expires_at) < new Date()) {
          res.status(410).json({ error: 'Invite code has expired' })
          return
        }

        // Check if already used
        if (invite.used) {
          res.status(410).json({ error: 'Invite code has already been used' })
          return
        }

        res.status(200).json({
          valid: true,
          tenantSlug: invite.tenant_slug,
          tenantName: invite.tenant_name,
          role: invite.role,
          email: invite.email
        })
        return
      }

      // If listing invites for a tenant (admin only)
      if (tenantSlug) {
        const token = getAuthToken(req)
        if (!token) {
          res.status(401).json({ error: 'Authentication required' })
          return
        }

        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
        const userId = payload.userId

        if (!userId) {
          res.status(401).json({ error: 'Invalid token' })
          return
        }

        const tenant = await getTenantFromSlug(tenantSlug)
        if (!tenant) {
          res.status(404).json({ error: 'Tenant not found' })
          return
        }

        // Verify admin access
        const access = await verifyTenantAccess(userId, tenant.id)
        if (!access.hasAccess || access.role !== 'admin') {
          res.status(403).json({ error: 'Only admins can view invites' })
          return
        }

        const sql = getSql()
        const rows = await sql`
          SELECT i.*, u.name as created_by_name
          FROM invites i
          LEFT JOIN users u ON u.id = i.created_by
          WHERE i.tenant_id = ${tenant.id}
          ORDER BY i.created_at DESC
        `

        res.status(200).json({ invites: rows })
        return
      }

      res.status(400).json({ error: 'code or tenantSlug parameter required' })
      return
    }

    // PATCH /api/invites - Accept an invite (join tenant)
    if (req.method === 'PATCH') {
      const { code, userId: targetUserId } = req.body || {}

      if (!code) {
        res.status(400).json({ error: 'Invite code is required' })
        return
      }

      // Get authenticated user
      const token = getAuthToken(req)
      if (!token && !targetUserId) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      let userId = targetUserId
      if (token) {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
        userId = payload.userId
      }

      if (!userId) {
        res.status(401).json({ error: 'Invalid token or userId' })
        return
      }

      const sql = getSql()

      // Get and validate invite
      const inviteRows = await sql`
        SELECT * FROM invites WHERE code = ${code} LIMIT 1
      `

      if (!inviteRows[0]) {
        res.status(404).json({ error: 'Invalid invite code' })
        return
      }

      const invite = inviteRows[0] as any

      if (new Date(invite.expires_at) < new Date()) {
        res.status(410).json({ error: 'Invite code has expired' })
        return
      }

      if (invite.used) {
        res.status(410).json({ error: 'Invite code has already been used' })
        return
      }

      // Mark invite as used
      await sql`UPDATE invites SET used = TRUE, used_by = ${userId}, used_at = NOW() WHERE id = ${invite.id}`

      // Add user to tenant
      await addUserToTenant(userId, invite.tenant_id, invite.role)

      res.status(200).json({
        message: 'Successfully joined organization',
        tenantId: invite.tenant_id,
        role: invite.role
      })
      return
    }

    // DELETE /api/invites?id=XXX - Cancel an invite (admin only)
    if (req.method === 'DELETE') {
      const { id: inviteId } = req.query as { id?: string }

      if (!inviteId) {
        res.status(400).json({ error: 'Invite id is required' })
        return
      }

      const token = getAuthToken(req)
      if (!token) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      const userId = payload.userId

      if (!userId) {
        res.status(401).json({ error: 'Invalid token' })
        return
      }

      const sql = getSql()

      // Get invite to check permissions
      const inviteRows = await sql`SELECT * FROM invites WHERE id = ${inviteId} LIMIT 1`
      if (!inviteRows[0]) {
        res.status(404).json({ error: 'Invite not found' })
        return
      }

      const invite = inviteRows[0] as any

      // Verify admin access
      const access = await verifyTenantAccess(userId, invite.tenant_id)
      if (!access.hasAccess || access.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can cancel invites' })
        return
      }

      await sql`DELETE FROM invites WHERE id = ${inviteId}`
      res.status(200).json({ message: 'Invite cancelled' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('Invites API error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
