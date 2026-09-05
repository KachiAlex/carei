import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from '../db.js'

function generateId(): string {
  return 'tl-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { clientId, taskName } = req.body || {}
  if (!clientId || !taskName) {
    res.status(400).json({ error: 'clientId and taskName required' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        // Verify caregiver is assigned to this client in this tenant
        const assignments = await tenantSql`
          SELECT 1 FROM caregiver_client_assignments
          WHERE caregiver_id = ${user.id} AND client_id = ${clientId} AND tenant_id = ${tenantId}
          LIMIT 1
        ` as any[]
        if (assignments.length === 0) {
          res.status(403).json({ error: 'Not assigned to this client in this organization' })
          return
        }

        const id = generateId()
        await tenantSql`
          INSERT INTO task_logs (id, client_id, caregiver_id, task_name, start_time, tenant_id)
          VALUES (${id}, ${clientId}, ${user.id}, ${taskName}, NOW(), ${tenantId})
        `

        res.status(201).json({ status: 'started', id, startTime: new Date().toISOString() })
      })
      return
    }

    // Legacy non-tenant handler
    // Verify caregiver is assigned to this client
    const assignments = await sql`
      SELECT 1 FROM caregiver_client_assignments
      WHERE caregiver_id = ${user.id} AND client_id = ${clientId}
      LIMIT 1
    ` as any[]
    if (assignments.length === 0) {
      res.status(403).json({ error: 'Not assigned to this client' })
      return
    }

    const id = generateId()
    await sql`
      INSERT INTO task_logs (id, client_id, caregiver_id, task_name, start_time)
      VALUES (${id}, ${clientId}, ${user.id}, ${taskName}, NOW())
    `

    res.status(201).json({ status: 'started', id, startTime: new Date().toISOString() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
