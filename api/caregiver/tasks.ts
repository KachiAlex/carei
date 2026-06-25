import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, userId, sql: tenantSql }) => {
        const { clientId } = req.query as { clientId?: string }

        if (clientId) {
          const assignment = await tenantSql`
            SELECT 1 FROM caregiver_client_assignments
            WHERE caregiver_id = ${userId} AND client_id = ${clientId} AND tenant_id = ${tenantId}
            LIMIT 1
          ` as any[]

          if (assignment.length === 0) {
            res.status(403).json({ error: 'Not assigned to this client' })
            return
          }

          const rows = await tenantSql`
            SELECT id, client_id AS "clientId", name, description, frequency, created_at AS "createdAt"
            FROM tasks WHERE client_id = ${clientId} AND tenant_id = ${tenantId} ORDER BY name
          ` as any[]

          res.status(200).json({ tasks: rows })
          return
        }

        const rows = await tenantSql`
          SELECT t.id, t.client_id AS "clientId", t.name, t.description, t.frequency, c.name AS "clientName"
          FROM tasks t
          JOIN clients c ON t.client_id = c.id AND c.tenant_id = ${tenantId}
          WHERE t.tenant_id = ${tenantId}
            AND c.id IN (
              SELECT client_id FROM caregiver_client_assignments WHERE caregiver_id = ${userId} AND tenant_id = ${tenantId}
            )
          ORDER BY c.name, t.name
        ` as any[]

        res.status(200).json({ tasks: rows })
      })
      return
    }

    // Legacy non-tenant handler
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }
    const userId = user.id

    const { clientId } = req.query as { clientId?: string }

    if (clientId) {
      const assignment = await sql`
        SELECT 1 FROM caregiver_client_assignments
        WHERE caregiver_id = ${userId} AND client_id = ${clientId}
        LIMIT 1
      ` as any[]

      if (assignment.length === 0) {
        res.status(403).json({ error: 'Not assigned to this client' })
        return
      }

      const rows = await sql`
        SELECT id, client_id AS "clientId", name, description, frequency, created_at AS "createdAt"
        FROM tasks WHERE client_id = ${clientId} ORDER BY name
      ` as any[]

      res.status(200).json({ tasks: rows })
      return
    }

    const rows = await sql`
      SELECT t.id, t.client_id AS "clientId", t.name, t.description, t.frequency, c.name AS "clientName"
      FROM tasks t
      JOIN clients c ON t.client_id = c.id
      WHERE c.id IN (
        SELECT client_id FROM caregiver_client_assignments WHERE caregiver_id = ${userId}
      )
      ORDER BY c.name, t.name
    ` as any[]

    res.status(200).json({ tasks: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
