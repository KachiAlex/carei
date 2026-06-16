import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, getAuthToken, ensureTables, getTenantFromSlug, getUserTenants, verifyTenantAccess, createTenant, addUserToTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const sql = getSql()

    // GET /api/tenants - List user's tenants
    if (req.method === 'GET') {
      const slug = req.query?.slug as string

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
      const token = getAuthToken(req)
      if (!token) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      // Decode token to get user ID (simple JWT decode)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      const userId = payload.userId

      if (!userId) {
        res.status(401).json({ error: 'Invalid token' })
        return
      }

      const tenants = await getUserTenants(userId)
      res.status(200).json({ tenants })
      return
    }

    // POST /api/tenants - Create new tenant
    if (req.method === 'POST') {
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

      try {
        const tenant = await createTenant({ slug, name, domain, plan: plan || 'trial' })
        // Add creator as admin
        await addUserToTenant(userId, tenant.id, 'admin')
        res.status(201).json({ id: tenant.id, slug, name, message: 'Tenant created successfully' })
      } catch (err: any) {
        if (err.message?.includes('unique constraint')) {
          res.status(409).json({ error: 'Tenant slug already exists' })
          return
        }
        throw err
      }
      return
    }

    // POST /api/tenants/join - Join a tenant
    if (req.method === 'PATCH' && req.query?.action === 'join') {
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

      const { tenantId, role = 'carer' } = req.body || {}

      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' })
        return
      }

      await addUserToTenant(userId, tenantId, role)
      res.status(200).json({ message: 'Joined tenant successfully' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('Tenants API error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
