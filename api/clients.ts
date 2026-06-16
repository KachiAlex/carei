import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { id } = req.query as { id?: string }
  const tenantSlug = getTenantSlug(req)

  // If tenant slug is provided, use tenant-aware filtering
  if (tenantSlug) {
    await withTenant(req, res, async ({ tenantId, sql }) => {
      if (req.method === 'GET') {
        if (id) {
          const rows = await sql`SELECT * FROM clients WHERE id = ${id} AND tenant_id = ${tenantId}`
          if (!rows[0]) {
            res.status(404).json({ error: 'Client not found' })
            return
          }
          const r = rows[0] as any
          // Fetch most recent handover note for this client (tenant-scoped)
          const lastVisit = await sql`
            SELECT handover_note, submitted_at
            FROM visits
            WHERE client_id = ${id} AND tenant_id = ${tenantId} AND handover_note IS NOT NULL AND handover_note <> ''
            ORDER BY submitted_at DESC
            LIMIT 1
          ` as any[]
          res.status(200).json({
            ...r,
            conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : (r.conditions || []),
            medications: typeof r.medications === 'string' ? JSON.parse(r.medications) : (r.medications || []),
            careCues: typeof r.care_cues === 'string' ? JSON.parse(r.care_cues) : (r.care_cues || []),
            lastHandover: lastVisit[0]?.handover_note || null,
            lastHandoverAt: lastVisit[0]?.submitted_at || null,
          })
          return
        }
        // List all clients for this tenant
        const rows = await sql`SELECT * FROM clients WHERE tenant_id = ${tenantId} ORDER BY name`
        const parsed = (rows as any[]).map((r) => ({
          ...r,
          conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : (r.conditions || []),
          medications: typeof r.medications === 'string' ? JSON.parse(r.medications) : (r.medications || []),
        }))
        res.status(200).json(parsed)
      }

      if (req.method === 'POST') {
        const body = req.body || {}
        const { id: bodyId, name, age, address, conditions, medications, preferences, emergencyContact, allergies, dysphagiaProtocol, supportFramework, communicationGuidance, mobility, careCues } = body
        if (!bodyId || !name) {
          res.status(400).json({ error: 'id and name required' })
          return
        }
        await sql`
          INSERT INTO clients (id, tenant_id, name, age, address, conditions, medications, preferences, emergency_contact, allergies, dysphagia_protocol, support_framework, communication_guidance, mobility, care_cues)
          VALUES (${bodyId}, ${tenantId}, ${name}, ${age || null}, ${address || null}, ${JSON.stringify(conditions || [])}, ${JSON.stringify(medications || [])}, ${preferences || null}, ${emergencyContact || null}, ${allergies || null}, ${dysphagiaProtocol || null}, ${supportFramework || null}, ${communicationGuidance || null}, ${mobility || null}, ${JSON.stringify(careCues || null)})
        `
        res.status(201).json({ status: 'created', id: bodyId })
      }

      if (req.method === 'PATCH' || req.method === 'PUT') {
        if (!id) {
          res.status(400).json({ error: 'id required' })
          return
        }
        const body = req.body || {}
        const { name, age, address, conditions, medications, preferences, emergencyContact, allergies, dysphagiaProtocol, supportFramework, communicationGuidance, mobility, careCues } = body
        await sql`
          UPDATE clients SET
            name = COALESCE(${name || null}, name),
            age = COALESCE(${age ?? null}, age),
            address = COALESCE(${address || null}, address),
            conditions = COALESCE(${JSON.stringify(conditions || null)}, conditions),
            medications = COALESCE(${JSON.stringify(medications || null)}, medications),
            preferences = COALESCE(${preferences || null}, preferences),
            emergency_contact = COALESCE(${emergencyContact || null}, emergency_contact),
            allergies = COALESCE(${allergies || null}, allergies),
            dysphagia_protocol = COALESCE(${dysphagiaProtocol || null}, dysphagia_protocol),
            support_framework = COALESCE(${supportFramework || null}, support_framework),
            communication_guidance = COALESCE(${communicationGuidance || null}, communication_guidance),
            mobility = COALESCE(${mobility || null}, mobility),
            care_cues = COALESCE(${JSON.stringify(careCues || null)}, care_cues)
          WHERE id = ${id} AND tenant_id = ${tenantId}
        `
        res.status(200).json({ status: 'updated', id })
      }

      if (req.method === 'DELETE') {
        if (!id) {
          res.status(400).json({ error: 'id required' })
          return
        }
        await sql`DELETE FROM clients WHERE id = ${id} AND tenant_id = ${tenantId}`
        res.status(200).json({ status: 'deleted', id })
      }
    })
    return
  }

  // Legacy non-tenant handler (for backwards compatibility - uses default tenant)
  try {
    await ensureTables()
    const sql = getSql()

    if (req.method === 'GET') {
      if (id) {
        const rows = await sql`SELECT * FROM clients WHERE id = ${id}`
        if (!rows[0]) {
          res.status(404).json({ error: 'Client not found' })
          return
        }
        const r = rows[0] as any
        res.status(200).json({
          ...r,
          conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : (r.conditions || []),
          medications: typeof r.medications === 'string' ? JSON.parse(r.medications) : (r.medications || []),
        })
      } else {
        const rows = await sql`SELECT * FROM clients ORDER BY name`
        const parsed = (rows as any[]).map((r) => ({
          ...r,
          conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : (r.conditions || []),
          medications: typeof r.medications === 'string' ? JSON.parse(r.medications) : (r.medications || []),
        }))
        res.status(200).json(parsed)
      }
      return
    }

    if (req.method === 'POST') {
      const body = req.body || {}
      const { id: bodyId, name, age, address, conditions, medications, preferences, emergencyContact, allergies, dysphagiaProtocol, supportFramework, communicationGuidance, mobility, careCues } = body
      if (!bodyId || !name) {
        res.status(400).json({ error: 'id and name required' })
        return
      }
      await sql`
        INSERT INTO clients (id, name, age, address, conditions, medications, preferences, emergency_contact, allergies, dysphagia_protocol, support_framework, communication_guidance, mobility, care_cues)
        VALUES (${bodyId}, ${name}, ${age || null}, ${address || null}, ${JSON.stringify(conditions || [])}, ${JSON.stringify(medications || [])}, ${preferences || null}, ${emergencyContact || null}, ${allergies || null}, ${dysphagiaProtocol || null}, ${supportFramework || null}, ${communicationGuidance || null}, ${mobility || null}, ${JSON.stringify(careCues || null)})
      `
      res.status(201).json({ status: 'created', id: bodyId })
      return
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (!id) {
        res.status(400).json({ error: 'id required' })
        return
      }
      const body = req.body || {}
      const { name, age, address, conditions, medications, preferences, emergencyContact, allergies, dysphagiaProtocol, supportFramework, communicationGuidance, mobility, careCues } = body
      await sql`
        UPDATE clients SET
          name = COALESCE(${name || null}, name),
          age = COALESCE(${age ?? null}, age),
          address = COALESCE(${address || null}, address),
          conditions = COALESCE(${JSON.stringify(conditions || null)}, conditions),
          medications = COALESCE(${JSON.stringify(medications || null)}, medications),
          preferences = COALESCE(${preferences || null}, preferences),
          emergency_contact = COALESCE(${emergencyContact || null}, emergency_contact),
          allergies = COALESCE(${allergies || null}, allergies),
          dysphagia_protocol = COALESCE(${dysphagiaProtocol || null}, dysphagia_protocol),
          support_framework = COALESCE(${supportFramework || null}, support_framework),
          communication_guidance = COALESCE(${communicationGuidance || null}, communication_guidance),
          mobility = COALESCE(${mobility || null}, mobility),
          care_cues = COALESCE(${JSON.stringify(careCues || null)}, care_cues)
        WHERE id = ${id}
      `
      res.status(200).json({ status: 'updated', id })
      return
    }

    if (req.method === 'DELETE') {
      if (!id) {
        res.status(400).json({ error: 'id required' })
        return
      }
      await sql`DELETE FROM clients WHERE id = ${id}`
      res.status(200).json({ status: 'deleted', id })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
