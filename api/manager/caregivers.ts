import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug, addUserToTenant } from '../db.js'

function generateId(): string {
  return 'cg-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const tenantSlug = getTenantSlug(req)
  if (!tenantSlug) {
    res.status(400).json({ error: 'Tenant slug required via X-Tenant-Slug header' })
    return
  }

  const body = req.body || {}
  const { name, email, phone, region, pin, role = 'carer' } = body
  if (!name || !email || !phone || !region || !pin) {
    res.status(400).json({ error: 'name, email, phone, region, and pin are required' })
    return
  }

  try {
    await ensureTables()
    await withTenant(req, res, async ({ tenantId, role: userRole, sql }) => {
      const isManager = userRole === 'manager' || userRole === 'admin'
      if (!isManager) {
        res.status(403).json({ error: 'Only managers can create caregivers' })
        return
      }

      const id = generateId()
      const caregiverToken = generateToken()

      const result = await sql`
        INSERT INTO users (id, tenant_id, name, email, phone, region, pin, role, token)
        VALUES (${id}, ${tenantId}, ${name}, ${email.toLowerCase()}, ${phone}, ${region}, ${pin}, ${role}, ${caregiverToken})
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      ` as any[]

      if (result.length === 0) {
        res.status(409).json({ error: 'Email already registered' })
        return
      }

      // Link user to tenant
      await addUserToTenant(id, tenantId, role)

      res.status(201).json({
        status: 'created',
        caregiver: { id, name, email: email.toLowerCase(), phone, region, role },
      })
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
