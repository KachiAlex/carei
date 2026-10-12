import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomBytes } from 'crypto'
import { setCors, ensureTables, withTenant } from './db.js'

const MANAGER_ROLES = ['manager', 'admin']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    await withTenant(req, res, async ({ tenantId, userId, role, sql }) => {
      const isManager = MANAGER_ROLES.includes(role)

      if (req.method === 'GET') {
        // Carers see their own most recent request; managers see the pending queue
        if (!isManager) {
          const rows = await sql`
            SELECT id, status, message, created_at, resolved_at
            FROM client_requests
            WHERE tenant_id = ${tenantId} AND carer_id = ${userId}
            ORDER BY created_at DESC LIMIT 1
          ` as any[]
          res.status(200).json({ requests: rows })
          return
        }
        const status = (req.query?.status as string) || 'pending'
        const rows = await sql`
          SELECT id, carer_id, carer_name, message, status, created_at, resolved_at, resolved_by
          FROM client_requests
          WHERE tenant_id = ${tenantId} AND status = ${status}
          ORDER BY created_at ASC LIMIT 50
        ` as any[]
        res.status(200).json({ requests: rows })
        return
      }

      if (req.method === 'POST') {
        const { message } = req.body || {}
        // One open request per carer at a time
        const existing = await sql`
          SELECT id FROM client_requests
          WHERE tenant_id = ${tenantId} AND carer_id = ${userId} AND status = 'pending'
          LIMIT 1
        ` as any[]
        if (existing.length > 0) {
          res.status(200).json({ status: 'already_requested', id: existing[0].id })
          return
        }
        const nameRows = await sql`SELECT name FROM users WHERE id = ${userId} LIMIT 1` as any[]
        const id = 'cr-' + randomBytes(8).toString('hex')
        await sql`
          INSERT INTO client_requests (id, tenant_id, carer_id, carer_name, message)
          VALUES (${id}, ${tenantId}, ${userId}, ${nameRows[0]?.name || null}, ${message || null})
        `
        res.status(201).json({ status: 'requested', id })
        return
      }

      if (req.method === 'PATCH') {
        if (!isManager) {
          res.status(403).json({ error: 'Manager access required' })
          return
        }
        const { id, action } = req.body || {}
        if (!id || !['resolve', 'dismiss'].includes(action)) {
          res.status(400).json({ error: 'id and action (resolve|dismiss) are required' })
          return
        }
        const result = await sql`
          UPDATE client_requests
          SET status = ${action === 'resolve' ? 'resolved' : 'dismissed'},
              resolved_at = NOW(), resolved_by = ${userId}
          WHERE id = ${id} AND tenant_id = ${tenantId} AND status = 'pending'
          RETURNING id
        ` as any[]
        if (result.length === 0) {
          res.status(404).json({ error: 'Request not found or already handled' })
          return
        }
        res.status(200).json({ status: 'updated', id })
        return
      }

      res.status(405).json({ error: 'Method not allowed' })
    })
  } catch (err: any) {
    console.error('[client-requests] error:', err)
    res.status(500).json({ error: err.message || 'Internal error' })
  }
}
