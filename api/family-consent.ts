import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug, logAuditEvent } from './db.js'
import { parseBody, z } from './validate.js'

const CONSENT_KEY = 'family_update_consent'

const putSchema = z.object({
  clientId: z.string().min(1),
  consent: z.boolean(),
})

function generateId(): string {
  return 'cs-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const tenantSlug = getTenantSlug(req)
    if (!tenantSlug) {
      res.status(400).json({ error: 'Tenant slug required (X-Tenant-Slug header)' })
      return
    }

    await withTenant(req, res, async ({ tenantId, userId, role, sql }) => {
      // ─── GET ?clientId= → current consent state ───
      if (req.method === 'GET') {
        const { clientId } = req.query as { clientId?: string }
        if (!clientId) { res.status(400).json({ error: 'clientId required' }); return }

        const rows = await sql`
          SELECT value, updated_by, updated_at FROM client_settings
          WHERE client_id = ${clientId} AND key = ${CONSENT_KEY} AND tenant_id = ${tenantId}
          LIMIT 1
        ` as any[]
        res.status(200).json({
          clientId,
          consent: rows[0]?.value === 'true',
          updatedBy: rows[0]?.updated_by || null,
          updatedAt: rows[0]?.updated_at || null,
        })
        return
      }

      // ─── PUT {clientId, consent} — managers/admins set consent ───
      if (req.method === 'PUT') {
        if (role !== 'manager' && role !== 'admin' && role !== 'superadmin') {
          res.status(403).json({ error: 'Managers only' })
          return
        }
        const parsed = parseBody(putSchema, req.body)
        if (!parsed.data) { res.status(400).json({ error: parsed.error }); return }
        const { clientId, consent } = parsed.data

        const clientRows = await sql`
          SELECT id FROM clients WHERE id = ${clientId} AND tenant_id = ${tenantId} LIMIT 1
        ` as any[]
        if (!clientRows[0]) { res.status(404).json({ error: 'Client not found' }); return }

        await sql`
          INSERT INTO client_settings (id, tenant_id, client_id, key, value, updated_by, updated_at)
          VALUES (${generateId()}, ${tenantId}, ${clientId}, ${CONSENT_KEY}, ${consent ? 'true' : 'false'}, ${userId}, NOW())
          ON CONFLICT (client_id, key)
          DO UPDATE SET value = ${consent ? 'true' : 'false'}, updated_by = ${userId}, updated_at = NOW()
        `

        await logAuditEvent({
          userId, tenantId,
          action: 'family_consent_updated',
          resource: 'client_settings',
          details: { clientId, consent },
        })

        res.status(200).json({ clientId, consent })
        return
      }

      res.status(405).json({ error: 'Method not allowed' })
    })
  } catch (err: any) {
    console.error('[family-consent] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
