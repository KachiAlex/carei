import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomBytes } from 'crypto'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, getTenantFromSlug, verifyTenantAccess, addUserToTenant, getTenantMemberCount } from './db.js'
import { hashCredential, generateSecureToken, hashToken } from './hash.js'

const VALID_ROLES = ['carer', 'manager', 'admin', 'viewer']

function generateLinkToken(): string {
  return randomBytes(24).toString('base64url')
}

async function getUserIdFromRequest(req: VercelRequest, sql: any): Promise<string | null> {
  const token = getAuthToken(req)
  if (!token) return null
  const user = await getUserFromToken(sql, token)
  return user?.id || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const sql = getSql()

    // POST /api/invite-links - Create a reusable invite link (admin only)
    if (req.method === 'POST') {
      const userId = await getUserIdFromRequest(req, sql)
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      const { tenantId, role = 'carer', label, maxUses, expiresInHours } = req.body || {}

      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' })
        return
      }

      if (!VALID_ROLES.includes(role)) {
        res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` })
        return
      }

      const access = await verifyTenantAccess(userId, tenantId)
      const canManage = access.hasAccess && (access.role === 'admin' || access.role === 'manager')
      if (!canManage) {
        res.status(403).json({ error: 'Only admins and managers can create invite links' })
        return
      }
      // Only tenant admins may create links that grant the admin role
      if (role === 'admin' && access.role !== 'admin') {
        res.status(403).json({ error: 'Only tenant admins can create admin invite links' })
        return
      }

      const tenantRows = await sql`SELECT name, slug, active, expires_at FROM tenants WHERE id = ${tenantId}` as any[]
      if (tenantRows.length === 0) { res.status(404).json({ error: 'Tenant not found' }); return }
      const t = tenantRows[0]
      if (t.active === false) { res.status(403).json({ error: 'Tenant is inactive' }); return }
      if (t.expires_at && new Date(t.expires_at) < new Date()) { res.status(403).json({ error: 'Tenant subscription expired' }); return }

      const token = generateLinkToken()
      const id = `invl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const expiresAt = expiresInHours
        ? new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000).toISOString()
        : null
      const maxUsesValue = maxUses ? Math.max(1, parseInt(maxUses, 10) || 1) : null

      await sql`
        INSERT INTO invite_links (id, tenant_id, token, role, label, created_by, expires_at, max_uses, uses, active)
        VALUES (${id}, ${tenantId}, ${token}, ${role}, ${label || null}, ${userId}, ${expiresAt}, ${maxUsesValue}, 0, TRUE)
      `

      const inviteUrl = `${process.env.FRONTEND_URL || 'https://careiapp.com'}/join?link=${token}`

      res.status(201).json({
        id,
        token,
        url: inviteUrl,
        role,
        label: label || null,
        maxUses: maxUsesValue,
        expiresAt,
        tenantName: t.name,
      })
      return
    }

    // GET /api/invite-links?token=XXX - Validate a link (public)
    // GET /api/invite-links?tenantSlug=YYY - List links (admin only)
    if (req.method === 'GET') {
      const { token, tenantSlug } = req.query as { token?: string; tenantSlug?: string }

      if (token) {
        const rows = await sql`
          SELECT l.*, t.slug as tenant_slug, t.name as tenant_name
          FROM invite_links l
          JOIN tenants t ON t.id = l.tenant_id
          WHERE l.token = ${token}
          LIMIT 1
        `

        if (!rows[0]) {
          res.status(404).json({ error: 'Invalid invite link' })
          return
        }

        const link = rows[0] as any

        if (!link.active) {
          res.status(410).json({ error: 'This invite link has been revoked' })
          return
        }
        if (link.expires_at && new Date(link.expires_at) < new Date()) {
          res.status(410).json({ error: 'This invite link has expired' })
          return
        }
        if (link.max_uses !== null && link.uses >= link.max_uses) {
          res.status(410).json({ error: 'This invite link has reached its maximum uses' })
          return
        }

        res.status(200).json({
          valid: true,
          tenantSlug: link.tenant_slug,
          tenantName: link.tenant_name,
          role: link.role,
          label: link.label,
          uses: link.uses,
          maxUses: link.max_uses,
          expiresAt: link.expires_at,
        })
        return
      }

      if (tenantSlug) {
        const userId = await getUserIdFromRequest(req, sql)
        if (!userId) {
          res.status(401).json({ error: 'Authentication required' })
          return
        }

        const tenant = await getTenantFromSlug(tenantSlug)
        if (!tenant) {
          res.status(404).json({ error: 'Tenant not found' })
          return
        }

        const access = await verifyTenantAccess(userId, tenant.id)
        if (!access.hasAccess || (access.role !== 'admin' && access.role !== 'manager')) {
          res.status(403).json({ error: 'Only admins and managers can view invite links' })
          return
        }

        const rows = await sql`
          SELECT l.*, u.name as created_by_name
          FROM invite_links l
          LEFT JOIN users u ON u.id = l.created_by
          WHERE l.tenant_id = ${tenant.id}
          ORDER BY l.created_at DESC
        `

        res.status(200).json({ links: rows })
        return
      }

      res.status(400).json({ error: 'token or tenantSlug parameter required' })
      return
    }

    // PATCH /api/invite-links - Join a tenant via invite link
    // Authenticated: { token } joins the logged-in user.
    // Unauthenticated: { token, user: { name, email, phone?, pin } } creates
    // the account, joins, and returns session tokens for auto-login.
    if (req.method === 'PATCH') {
      const { token: linkToken, user: newUser } = req.body || {}

      if (!linkToken) {
        res.status(400).json({ error: 'token is required' })
        return
      }

      const linkRows = await sql`
        SELECT l.*, t.slug as tenant_slug, t.name as tenant_name, t.max_users
        FROM invite_links l
        JOIN tenants t ON t.id = l.tenant_id
        WHERE l.token = ${linkToken}
        LIMIT 1
      `

      if (!linkRows[0]) {
        res.status(404).json({ error: 'Invalid invite link' })
        return
      }

      const link = linkRows[0] as any

      const userId = await getUserIdFromRequest(req, sql)

      // ── Signup path: create account + join via the link ──
      if (!userId) {
        if (!newUser || typeof newUser !== 'object') {
          res.status(401).json({ error: 'Authentication required' })
          return
        }

        const name = (newUser.name || '').trim()
        const email = (newUser.email || '').trim().toLowerCase()
        const phone = (newUser.phone || '').trim()
        const pin = newUser.pin || ''

        if (!name || !email || !pin) {
          res.status(400).json({ error: 'name, email, and pin are required' })
          return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.status(400).json({ error: 'Invalid email address' })
          return
        }
        if (!/^\d{4,6}$/.test(pin)) {
          res.status(400).json({ error: 'PIN must be 4-6 digits' })
          return
        }

        // Email must not already be registered
        const existingUser = await sql`SELECT id FROM users WHERE LOWER(email) = ${email} LIMIT 1` as any[]
        if (existingUser.length > 0) {
          res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' })
          return
        }

        // Plan limit check before consuming a use
        if (link.max_users) {
          const memberCount = await getTenantMemberCount(link.tenant_id)
          if (memberCount >= link.max_users) {
            res.status(403).json({ error: 'Organization has reached its member limit' })
            return
          }
        }

        // Atomically consume a use — fails if link is revoked, expired, or exhausted
        const consumed = await sql`
          UPDATE invite_links
          SET uses = uses + 1
          WHERE id = ${link.id}
            AND active = TRUE
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (max_uses IS NULL OR uses < max_uses)
          RETURNING uses
        `
        if (consumed.length === 0) {
          res.status(410).json({ error: 'This invite link is no longer valid' })
          return
        }

        const newUserId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const pinHash = await hashCredential(pin)

        const accessToken = generateSecureToken()
        const accessTokenHash = await hashToken(accessToken)
        const accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
        const refreshToken = generateSecureToken()
        const refreshTokenHash = await hashToken(refreshToken)
        const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

        await sql`
          INSERT INTO users (id, name, email, phone, region, pin_hash, role, token_hash, token_expires_at, refresh_token_hash, refresh_token_expires_at, email_verified)
          VALUES (${newUserId}, ${name}, ${email}, ${phone}, ${newUser.region || ''}, ${pinHash}, ${link.role}, ${accessTokenHash}, ${accessTokenExpiresAt}, ${refreshTokenHash}, ${refreshTokenExpiresAt}, TRUE)
        `

        await addUserToTenant(newUserId, link.tenant_id, link.role)

        res.setHeader('Set-Cookie', `carei_token=${accessToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
        res.status(201).json({
          message: 'Account created and joined organization',
          token: accessToken,
          refreshToken,
          user: { id: newUserId, name, email, phone, role: link.role },
          tenantId: link.tenant_id,
          tenantSlug: link.tenant_slug,
          tenantName: link.tenant_name,
          role: link.role,
        })
        return
      }

      // ── Authenticated path: join the logged-in user ──
      // Already a member — treat as success without consuming a use
      const existing = await verifyTenantAccess(userId, link.tenant_id)
      if (existing.hasAccess) {
        res.status(200).json({
          message: 'Already a member of this organization',
          tenantId: link.tenant_id,
          tenantSlug: link.tenant_slug,
          tenantName: link.tenant_name,
          role: existing.role,
          alreadyMember: true,
        })
        return
      }

      // Plan limit check
      if (link.max_users) {
        const memberCount = await getTenantMemberCount(link.tenant_id)
        if (memberCount >= link.max_users) {
          res.status(403).json({ error: 'Organization has reached its member limit' })
          return
        }
      }

      // Atomically consume a use — fails if link is revoked, expired, or exhausted
      const consumed = await sql`
        UPDATE invite_links
        SET uses = uses + 1
        WHERE id = ${link.id}
          AND active = TRUE
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (max_uses IS NULL OR uses < max_uses)
        RETURNING uses
      `

      if (consumed.length === 0) {
        res.status(410).json({ error: 'This invite link is no longer valid' })
        return
      }

      await addUserToTenant(userId, link.tenant_id, link.role)

      res.status(200).json({
        message: 'Successfully joined organization',
        tenantId: link.tenant_id,
        tenantSlug: link.tenant_slug,
        tenantName: link.tenant_name,
        role: link.role,
      })
      return
    }

    // DELETE /api/invite-links?id=XXX - Revoke a link (admin only)
    if (req.method === 'DELETE') {
      const { id } = req.query as { id?: string }

      if (!id) {
        res.status(400).json({ error: 'id is required' })
        return
      }

      const userId = await getUserIdFromRequest(req, sql)
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      const linkRows = await sql`SELECT * FROM invite_links WHERE id = ${id} LIMIT 1`
      if (!linkRows[0]) {
        res.status(404).json({ error: 'Invite link not found' })
        return
      }

      const link = linkRows[0] as any
      const access = await verifyTenantAccess(userId, link.tenant_id)
      if (!access.hasAccess || (access.role !== 'admin' && access.role !== 'manager')) {
        res.status(403).json({ error: 'Only admins and managers can revoke invite links' })
        return
      }

      await sql`UPDATE invite_links SET active = FALSE WHERE id = ${id}`
      res.status(200).json({ message: 'Invite link revoked' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('Invite links API error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
