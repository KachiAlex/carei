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

  const { clientId, evv } = req.body || {}
  if (!clientId) {
    res.status(400).json({ error: 'clientId required' })
    return
  }

  // Unified EVV evidence: geolocation + optional NFC tag scan captured at clock-in
  const evvData = {
    lat: typeof evv?.lat === 'number' ? evv.lat : null,
    lng: typeof evv?.lng === 'number' ? evv.lng : null,
    accuracy: typeof evv?.accuracy === 'number' ? evv.accuracy : null,
    distanceM: typeof evv?.distanceM === 'number' ? evv.distanceM : null,
    geoOverrideReason: typeof evv?.geoOverrideReason === 'string' ? evv.geoOverrideReason.slice(0, 500) : null,
    tagId: typeof evv?.tagId === 'string' ? evv.tagId.slice(0, 100) : null,
    tagMethod: typeof evv?.tagMethod === 'string' ? evv.tagMethod.slice(0, 30) : null,
  }
  const geoVerified = evvData.lat !== null && evvData.lng !== null && evvData.geoOverrideReason === null
  const tagVerified = evvData.tagId !== null

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

        // If the client has a registered NFC tag, verify the scanned tag matches
        let tagMatch: boolean | null = null
        if (evvData.tagId) {
          const tagRows = await tenantSql`SELECT tag_id FROM clients WHERE id = ${c.id}` as any[]
          if (tagRows[0]?.tag_id) tagMatch = tagRows[0].tag_id === evvData.tagId
        }

        await tenantSql`
          INSERT INTO visits (
            id, tenant_id, client_id, client_name, client_age, client_address,
            status, clock_in_at, tasks, medications, submitted_at,
            clock_in_lat, clock_in_lng, clock_in_accuracy, geo_verified,
            geo_distance_m, geo_override_reason,
            tag_scan_id, tag_scan_method, tag_scanned_at, tag_verified
          ) VALUES (
            ${visitId}, ${tenantId}, ${c.id}, ${c.name}, ${c.age || null}, ${c.address || null},
            'active', NOW(), ${JSON.stringify([])}, ${JSON.stringify(c.medications || [])}, NOW(),
            ${evvData.lat}, ${evvData.lng}, ${evvData.accuracy}, ${geoVerified},
            ${evvData.distanceM}, ${evvData.geoOverrideReason},
            ${evvData.tagId}, ${evvData.tagMethod}, ${evvData.tagId ? new Date().toISOString() : null},
            ${tagMatch === null ? tagVerified : tagMatch}
          )
        `

        res.status(201).json({
          visitId, clientId: c.id, clientName: c.name, clientAge: c.age,
          clientAddress: c.address, status: 'active',
          conditions: c.conditions, medications: c.medications,
          preferences: c.preferences, emergencyContact: c.emergency_contact,
          evv: { geoVerified, tagVerified: tagMatch === null ? tagVerified : tagMatch },
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

    let tagMatch: boolean | null = null
    if (evvData.tagId) {
      const tagRows = await sql`SELECT tag_id FROM clients WHERE id = ${c.id}` as any[]
      if (tagRows[0]?.tag_id) tagMatch = tagRows[0].tag_id === evvData.tagId
    }

    await sql`
      INSERT INTO visits (
        id, client_id, client_name, client_age, client_address,
        status, clock_in_at, tasks, medications, submitted_at,
        clock_in_lat, clock_in_lng, clock_in_accuracy, geo_verified,
        geo_distance_m, geo_override_reason,
        tag_scan_id, tag_scan_method, tag_scanned_at, tag_verified
      ) VALUES (
        ${visitId}, ${c.id}, ${c.name}, ${c.age || null}, ${c.address || null},
        'active', NOW(), ${JSON.stringify([])}, ${JSON.stringify(c.medications || [])}, NOW(),
        ${evvData.lat}, ${evvData.lng}, ${evvData.accuracy}, ${geoVerified},
        ${evvData.distanceM}, ${evvData.geoOverrideReason},
        ${evvData.tagId}, ${evvData.tagMethod}, ${evvData.tagId ? new Date().toISOString() : null},
        ${tagMatch === null ? tagVerified : tagMatch}
      )
    `

    res.status(201).json({
      visitId, clientId: c.id, clientName: c.name, clientAge: c.age,
      clientAddress: c.address, status: 'active',
      conditions: c.conditions, medications: c.medications,
      preferences: c.preferences, emergencyContact: c.emergency_contact,
      evv: { geoVerified, tagVerified: tagMatch === null ? tagVerified : tagMatch },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
