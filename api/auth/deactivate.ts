import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, getTenantSlug, getTenantFromSlug, verifyTenantAccess, logSecurityEvent } from '../db.js'
import { parseBody, z } from '../validate.js'

const deactivateSchema = z.object({
  userId: z.string().optional(), // managers deactivate members; self-deactivation omits this
  reason: z.string().max(500).optional(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  try {
    await ensureTables()
    const sql = getSql()
    const token = getAuthToken(req)
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    const parsed = parseBody(deactivateSchema, req.body)
    if (!parsed.data) { res.status(400).json({ error: parsed.error }); return }
    const { userId, reason } = parsed.data

    const targetId = userId || user.id
    let tenantId: string | null = null

    // Self-deactivation is always allowed; deactivating someone else requires
    // manager/admin/superadmin within the same tenant.
    const tenantSlug = getTenantSlug(req)
    if (targetId !== user.id) {
      if (!tenantSlug) { res.status(400).json({ error: 'Tenant slug required to deactivate another user' }); return }
      const tenant = await getTenantFromSlug(tenantSlug)
      if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return }
      const access = await verifyTenantAccess(user.id, tenant.id)
      if (!access.hasAccess || !['manager', 'admin', 'superadmin'].includes(access.role)) {
        res.status(403).json({ error: 'Managers only' })
        return
      }
      const targetAccess = await verifyTenantAccess(targetId, tenant.id)
      if (!targetAccess.hasAccess) {
        res.status(404).json({ error: 'User not found in this organization' })
        return
      }
      tenantId = tenant.id
    } else if (tenantSlug) {
      tenantId = (await getTenantFromSlug(tenantSlug))?.id || null
    }

    const target = await sql`SELECT id, email, status FROM users WHERE id = ${targetId} LIMIT 1` as any[]
    if (!target[0]) { res.status(404).json({ error: 'User not found' }); return }
    if (target[0].status === 'deactivated') {
      res.status(200).json({ status: 'already deactivated', userId: targetId })
      return
    }

    await sql`
      UPDATE users
      SET status = 'deactivated', deactivated_at = NOW(),
          token = NULL, token_hash = NULL, token_expires_at = NULL,
          refresh_token_hash = NULL, refresh_token_expires_at = NULL
      WHERE id = ${targetId}
    `

    await logSecurityEvent({
      tenantId: tenantId || null,
      eventType: 'account_deactivated',
      actorId: user.id,
      actorEmail: user.email,
      subjectEmail: target[0].email,
      metadata: { reason: reason || null, self: targetId === user.id },
    })

    res.status(200).json({ status: 'deactivated', userId: targetId })
  } catch (err: any) {
    console.error('[auth/deactivate] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
