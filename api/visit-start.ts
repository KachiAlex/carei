import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from './db.js'

function generateId(): string {
  return 'visit-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
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
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const { clientId } = req.body || {}
  if (!clientId) {
    res.status(400).json({ error: 'clientId required' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, userId, sql: tenantSql }) => {
        // Verify caregiver is assigned to this client in this tenant
        const assignment = await tenantSql`
          SELECT 1 FROM caregiver_client_assignments
          WHERE caregiver_id = ${userId} AND client_id = ${clientId} AND tenant_id = ${tenantId}
          LIMIT 1
        ` as any[]
        if (assignment.length === 0) {
          res.status(403).json({ error: 'Not assigned to this client in this organization' })
          return
        }

        const clientRows = await tenantSql`
          SELECT id, name, age, address, conditions, medications, preferences, emergency_contact
          FROM clients WHERE id = ${clientId} AND tenant_id = ${tenantId} LIMIT 1
        ` as any[]

        if (!clientRows[0]) {
          res.status(404).json({ error: 'Client not found' })
          return
        }

        const c = clientRows[0]
        const visitId = generateId()

        await tenantSql`
          INSERT INTO visits (
            id, tenant_id, client_id, client_name, client_age, client_address,
            status, clock_in_at, tasks, medications, submitted_at
          ) VALUES (
            ${visitId}, ${tenantId}, ${c.id}, ${c.name}, ${c.age || null}, ${c.address || null},
            'active', NOW(), ${JSON.stringify([])}, ${JSON.stringify(c.medications || [])}, NOW()
          )
        `

        res.status(201).json({
          visitId, clientId: c.id, clientName: c.name, clientAge: c.age,
          clientAddress: c.address, status: 'active',
          conditions: c.conditions, medications: c.medications,
          preferences: c.preferences, emergencyContact: c.emergency_contact,
        })
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

    const clientRows = await sql`
      SELECT id, name, age, address, conditions, medications, preferences, emergency_contact
      FROM clients WHERE id = ${clientId} LIMIT 1
    ` as any[]

    if (!clientRows[0]) {
      res.status(404).json({ error: 'Client not found' })
      return
    }

    const c = clientRows[0]
    const visitId = generateId()

    await sql`
      INSERT INTO visits (
        id, client_id, client_name, client_age, client_address,
        status, clock_in_at, tasks, medications, submitted_at
      ) VALUES (
        ${visitId}, ${c.id}, ${c.name}, ${c.age || null}, ${c.address || null},
        'active', NOW(), ${JSON.stringify([])}, ${JSON.stringify(c.medications || [])}, NOW()
      )
    `

    res.status(201).json({
      visitId, clientId: c.id, clientName: c.name, clientAge: c.age,
      clientAddress: c.address, status: 'active',
      conditions: c.conditions, medications: c.medications,
      preferences: c.preferences, emergencyContact: c.emergency_contact,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
