import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getSql, setCors, getAuthToken, ensureTables, getTenantFromSlug,
  getUserTenants, verifyTenantAccess, createTenant, addUserToTenant,
  getTenantSlug, getUserFromToken, getTenantMembers, getTenantStats,
  getTenantMemberCount, getAllTenantsWithStats, getTenantClientCount,
} from './db.js'

// Plan defaults for new tenants
const PLAN_DEFAULTS: Record<string, { max_users: number; max_clients: number }> = {
  trial: { max_users: 3, max_clients: 10 },
  professional: { max_users: 15, max_clients: 100 },
  enterprise: { max_users: 100, max_clients: 500 },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const sql = getSql()

    // ──────────────────────────────────────────
    // GET /api/tenants
    // ──────────────────────────────────────────
    if (req.method === 'GET') {
      const token = getAuthToken(req)
      const slug = req.query?.slug as string
      const members = req.query?.members as string
      const stats = req.query?.stats as string
      const admin = req.query?.admin as string

      // If admin flag, verify superadmin and return all tenants
      if (admin === 'true') {
        if (!token) { res.status(401).json({ error: 'Authentication required' }); return }
        const user = await getUserFromToken(sql, token)
        if (!user) { res.status(401).json({ error: 'Invalid token' }); return }
        if (user.role !== 'superadmin') { res.status(403).json({ error: 'Superadmin access required' }); return }

        const tenants = await getAllTenantsWithStats()
        res.status(200).json({ tenants })
        return
      }

      // If members requested, list tenant members
      if (members) {
        if (!token) { res.status(401).json({ error: 'Authentication required' }); return }
        const user = await getUserFromToken(sql, token)
        if (!user) { res.status(401).json({ error: 'Invalid token' }); return }

        const tenant = await getTenantFromSlug(members)
        if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return }

        const access = await verifyTenantAccess(user.id, tenant.id)
        if (!access.hasAccess) { res.status(403).json({ error: 'Access denied' }); return }

        const memberList = await getTenantMembers(tenant.id)
        res.status(200).json({ members: memberList })
        return
      }

      // If stats requested, return tenant stats
      if (stats) {
        if (!token) { res.status(401).json({ error: 'Authentication required' }); return }
        const user = await getUserFromToken(sql, token)
        if (!user) { res.status(401).json({ error: 'Invalid token' }); return }

        const tenant = await getTenantFromSlug(stats)
        if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return }

        const access = await verifyTenantAccess(user.id, tenant.id)
        if (!access.hasAccess) { res.status(403).json({ error: 'Access denied' }); return }

        const tenantStats = await getTenantStats(tenant.id)
        res.status(200).json(tenantStats)
        return
      }

      // If slug provided, get specific tenant details
      if (slug) {
        const tenant = await getTenantFromSlug(slug)
        if (!tenant) {
          res.status(404).json({ error: 'Tenant not found' })
          return
        }
        res.status(200).json(tenant)
        return
      }

      // Otherwise list all tenants for authenticated user
      if (!token) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      const user = await getUserFromToken(sql, token)
      if (!user) {
        res.status(401).json({ error: 'Invalid token' })
        return
      }

      const tenants = await getUserTenants(user.id)
      res.status(200).json({ tenants })
      return
    }

    // ──────────────────────────────────────────
    // POST /api/tenants - Create new tenant
    // ──────────────────────────────────────────
    if (req.method === 'POST') {
      const token = getAuthToken(req)
      if (!token) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      const user = await getUserFromToken(sql, token)
      if (!user) {
        res.status(401).json({ error: 'Invalid token' })
        return
      }

      const { slug, name, domain, plan } = req.body || {}

      if (!slug || !name) {
        res.status(400).json({ error: 'slug and name are required' })
        return
      }

      // Validate slug format (lowercase, alphanumeric, hyphens)
      if (!/^[a-z0-9-]+$/.test(slug)) {
        res.status(400).json({ error: 'Slug must be lowercase alphanumeric with hyphens only' })
        return
      }

      const resolvedPlan = (plan || 'trial').toLowerCase()
      const defaults = PLAN_DEFAULTS[resolvedPlan] || PLAN_DEFAULTS.trial

      try {
        const tenant = await createTenant({ slug, name, domain, plan: resolvedPlan })
        // Apply plan defaults
        await sql`
          UPDATE tenants
          SET max_users = ${defaults.max_users},
              max_clients = ${defaults.max_clients}
          WHERE id = ${tenant.id}
        `
        // Add creator as admin
        await addUserToTenant(user.id, tenant.id, 'admin')
        res.status(201).json({
          id: tenant.id,
          slug,
          name,
          plan: resolvedPlan,
          max_users: defaults.max_users,
          max_clients: defaults.max_clients,
          message: 'Tenant created successfully',
        })
      } catch (err: any) {
        if (err.message?.includes('unique constraint')) {
          res.status(409).json({ error: 'Tenant slug already exists' })
          return
        }
        throw err
      }
      return
    }

    // ──────────────────────────────────────────
    // PUT /api/tenants - Update tenant settings
    // ──────────────────────────────────────────
    if (req.method === 'PUT') {
      const token = getAuthToken(req)
      if (!token) { res.status(401).json({ error: 'Authentication required' }); return }

      const user = await getUserFromToken(sql, token)
      if (!user) { res.status(401).json({ error: 'Invalid token' }); return }

      const targetSlug = req.query?.slug as string
      if (!targetSlug) { res.status(400).json({ error: 'slug query param required' }); return }

      const tenant = await getTenantFromSlug(targetSlug)
      if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return }

      const access = await verifyTenantAccess(user.id, tenant.id)
      if (!access.hasAccess) { res.status(403).json({ error: 'Access denied' }); return }
      if (access.role !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return }

      const { name, settings } = req.body || {}
      let hasField = false

      if (name !== undefined) {
        await sql`UPDATE tenants SET name = ${name}, updated_at = NOW() WHERE id = ${tenant.id}`
        hasField = true
      }
      if (settings !== undefined) {
        await sql`UPDATE tenants SET settings = ${JSON.stringify(settings)}, updated_at = NOW() WHERE id = ${tenant.id}`
        hasField = true
      }

      if (!hasField) { res.status(400).json({ error: 'No fields to update' }); return }

      res.status(200).json({ message: 'Tenant updated successfully' })
      return
    }

    // ──────────────────────────────────────────
    // PATCH /api/tenants - Plan / Active / Join
    // ──────────────────────────────────────────
    if (req.method === 'PATCH') {
      const token = getAuthToken(req)
      if (!token) { res.status(401).json({ error: 'Authentication required' }); return }

      const user = await getUserFromToken(sql, token)
      if (!user) { res.status(401).json({ error: 'Invalid token' }); return }

      const action = req.query?.action as string
      const targetSlug = req.query?.slug as string

      // Join tenant
      if (action === 'join') {
        const { tenantId, role = 'carer' } = req.body || {}
        if (!tenantId) { res.status(400).json({ error: 'tenantId is required' }); return }

        // Check tenant active and not expired
        const tenantRows = await sql`SELECT active, expires_at, max_users, plan FROM tenants WHERE id = ${tenantId}` as any[]
        if (tenantRows.length === 0) { res.status(404).json({ error: 'Tenant not found' }); return }
        const t = tenantRows[0]
        if (t.active === false) { res.status(403).json({ error: 'Tenant is inactive' }); return }
        if (t.expires_at && new Date(t.expires_at) < new Date()) { res.status(403).json({ error: 'Tenant subscription expired' }); return }

        // Check plan limit
        const currentCount = await getTenantMemberCount(tenantId)
        if (t.max_users && currentCount >= t.max_users) {
          res.status(403).json({ error: 'Tenant user limit reached. Upgrade plan to add more members.' })
          return
        }

        await addUserToTenant(user.id, tenantId, role)
        res.status(200).json({ message: 'Joined tenant successfully' })
        return
      }

      // Update plan (superadmin only)
      if (action === 'plan') {
        if (user.role !== 'superadmin') { res.status(403).json({ error: 'Superadmin access required' }); return }
        if (!targetSlug) { res.status(400).json({ error: 'slug query param required' }); return }

        const tenant = await getTenantFromSlug(targetSlug)
        if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return }

        const { plan } = req.body || {}
        if (!plan) { res.status(400).json({ error: 'plan is required' }); return }

        const resolvedPlan = plan.toLowerCase()
        const defaults = PLAN_DEFAULTS[resolvedPlan] || PLAN_DEFAULTS.trial

        await sql`
          UPDATE tenants
          SET plan = ${resolvedPlan},
              max_users = ${defaults.max_users},
              max_clients = ${defaults.max_clients},
              updated_at = NOW()
          WHERE id = ${tenant.id}
        `
        res.status(200).json({
          message: 'Plan updated successfully',
          plan: resolvedPlan,
          max_users: defaults.max_users,
          max_clients: defaults.max_clients,
        })
        return
      }

      // Toggle active (superadmin only)
      if (action === 'active') {
        if (user.role !== 'superadmin') { res.status(403).json({ error: 'Superadmin access required' }); return }
        if (!targetSlug) { res.status(400).json({ error: 'slug query param required' }); return }

        const tenant = await getTenantFromSlug(targetSlug)
        if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return }

        const { active } = req.body || {}
        if (typeof active !== 'boolean') { res.status(400).json({ error: 'active boolean is required' }); return }

        await sql`UPDATE tenants SET active = ${active}, updated_at = NOW() WHERE id = ${tenant.id}`
        res.status(200).json({ message: `Tenant ${active ? 'activated' : 'deactivated'}`, active })
        return
      }

      res.status(400).json({ error: 'Unknown patch action' })
      return
    }

    // ──────────────────────────────────────────
    // DELETE /api/tenants - Delete tenant
    // ──────────────────────────────────────────
    if (req.method === 'DELETE') {
      const token = getAuthToken(req)
      if (!token) { res.status(401).json({ error: 'Authentication required' }); return }

      const user = await getUserFromToken(sql, token)
      if (!user) { res.status(401).json({ error: 'Invalid token' }); return }

      if (user.role !== 'superadmin') { res.status(403).json({ error: 'Superadmin access required' }); return }

      const targetSlug = req.query?.slug as string
      if (!targetSlug) { res.status(400).json({ error: 'slug query param required' }); return }

      const tenant = await getTenantFromSlug(targetSlug)
      if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return }

      await sql`DELETE FROM tenants WHERE id = ${tenant.id}`
      res.status(200).json({ message: 'Tenant deleted successfully' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('Tenants API error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
