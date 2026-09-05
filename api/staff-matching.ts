import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, getTenantSlug } from './db.js'

interface CarerMatch {
  carerId: string
  carerName: string
  score: number
  reasons: string[]
  skills: string[]
  languages: string[]
  proximity: 'same' | 'near' | 'far' | 'unknown'
  continuityVisits: number
}

function safeJson<T>(value: unknown): T | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T } catch { return undefined }
  }
  return value as T
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const token = getAuthToken(req)
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'superadmin') {
      res.status(403).json({ error: 'Managers only' })
      return
    }

    const { clientId } = req.query as { clientId?: string }
    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' })
      return
    }

    const slug = getTenantSlug(req)
    let tenantId: string | null = null
    if (slug) {
      const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1` as any[]
      tenantId = tenantRows[0]?.id || null
    }

    // Load client data
    let clientRows: any[]
    if (tenantId) {
      clientRows = await sql`SELECT * FROM clients WHERE id = ${clientId} AND tenant_id = ${tenantId} LIMIT 1` as any[]
    } else {
      clientRows = await sql`SELECT * FROM clients WHERE id = ${clientId} LIMIT 1` as any[]
    }

    if (!clientRows[0]) {
      res.status(404).json({ error: 'Client not found' })
      return
    }

    const client = clientRows[0]
    const clientConditions = safeJson<string[]>(client.conditions) || []
    const clientLanguages = safeJson<string[]>(client.languages) || []
    const clientAddress = client.address || ''
    const clientCareCues = safeJson<string[]>(client.care_cues) || []

    // Load all active carers in tenant
    let carerRows: any[]
    if (tenantId) {
      carerRows = await sql`
        SELECT id, name, email, phone, role, region, skills, languages, address
        FROM users
        WHERE role = 'carer'
          AND id IN (SELECT user_id FROM tenant_users WHERE tenant_id = ${tenantId})
      ` as any[]
    } else {
      carerRows = await sql`SELECT id, name, email, phone, role, region, skills, languages, address FROM users WHERE role = 'carer'` as any[]
    }

    // Load visit history for continuity scoring
    let visitHistory: any[]
    if (tenantId) {
      visitHistory = await sql`
        SELECT carer_id, client_id, COUNT(*) as visit_count
        FROM visits
        WHERE tenant_id = ${tenantId}
          AND client_id = ${clientId}
          AND status = 'completed'
        GROUP BY carer_id, client_id
      ` as any[]
    } else {
      visitHistory = await sql`
        SELECT carer_id, client_id, COUNT(*) as visit_count
        FROM visits
        WHERE client_id = ${clientId}
          AND status = 'completed'
        GROUP BY carer_id, client_id
      ` as any[]
    }

    const continuityMap = new Map<string, number>()
    for (const v of visitHistory) {
      if (v.carer_id) continuityMap.set(v.carer_id, parseInt(v.visit_count, 10))
    }

    // Load carer availability
    let availabilityRows: any[] = []
    try {
      if (tenantId) {
        availabilityRows = await sql`
          SELECT user_id, day_of_week, start_time, end_time, available
          FROM availability
          WHERE tenant_id = ${tenantId}
        ` as any[]
      } else {
        availabilityRows = await sql`SELECT user_id, day_of_week, start_time, end_time, available FROM availability` as any[]
      }
    } catch {}

    const availabilityMap = new Map<string, any[]>()
    for (const a of availabilityRows) {
      if (!availabilityMap.has(a.user_id)) availabilityMap.set(a.user_id, [])
      availabilityMap.get(a.user_id)!.push(a)
    }

    // Score each carer
    const matches: CarerMatch[] = []

    for (const carer of carerRows) {
      const carerSkills = safeJson<string[]>(carer.skills) || []
      const carerLanguages = safeJson<string[]>(carer.languages) || []
      const carerAddress = carer.address || ''
      const carerRegion = carer.region || ''

      let score = 0
      const reasons: string[] = []

      // 1. Skills match (max 30 points)
      const matchedSkills = carerSkills.filter(s =>
        clientConditions.some(c => c.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(c.toLowerCase()))
      )
      if (matchedSkills.length > 0) {
        score += Math.min(30, matchedSkills.length * 10)
        reasons.push(`Skills match: ${matchedSkills.join(', ')}`)
      }

      // 2. Language match (max 20 points)
      const matchedLanguages = carerLanguages.filter(l =>
        clientLanguages.some(cl => cl.toLowerCase() === l.toLowerCase())
      )
      if (matchedLanguages.length > 0) {
        score += 20
        reasons.push(`Language match: ${matchedLanguages.join(', ')}`)
      } else if (clientLanguages.length === 0) {
        score += 5 // No language requirement specified
      }

      // 3. Continuity (max 30 points) — highest weight as CAREi differentiator
      const continuityVisits = continuityMap.get(carer.id) || 0
      if (continuityVisits > 0) {
        score += Math.min(30, continuityVisits * 5)
        reasons.push(`Continuity: ${continuityVisits} previous visit(s) with this client`)
      }

      // 4. Proximity (max 10 points)
      let proximity: CarerMatch['proximity'] = 'unknown'
      if (carerAddress && clientAddress) {
        if (carerAddress.toLowerCase().includes(clientAddress.toLowerCase().split(',')[0].toLowerCase())) {
          score += 10
          proximity = 'same'
          reasons.push('Same area as client')
        } else if (carerRegion && clientAddress.toLowerCase().includes(carerRegion.toLowerCase())) {
          score += 7
          proximity = 'near'
          reasons.push(`Nearby region: ${carerRegion}`)
        } else {
          proximity = 'far'
        }
      }

      // 5. Availability (max 10 points)
      const carerAvail = availabilityMap.get(carer.id) || []
      const hasAvailability = carerAvail.some(a => a.available !== false)
      if (hasAvailability) {
        score += 10
        reasons.push('Has availability recorded')
      }

      matches.push({
        carerId: carer.id,
        carerName: carer.name,
        score: Math.min(100, score),
        reasons,
        skills: carerSkills,
        languages: carerLanguages,
        proximity,
        continuityVisits,
      })
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score)

    res.status(200).json({
      clientId,
      clientName: client.name,
      matches: matches.slice(0, 10), // Top 10
      totalCarers: carerRows.length,
      scoringCriteria: {
        skills: 'Up to 30 points for matching client conditions',
        language: 'Up to 20 points for matching client languages',
        continuity: 'Up to 30 points for prior visits with this client (CAREi differentiator)',
        proximity: 'Up to 10 points for geographic proximity',
        availability: 'Up to 10 points for having availability recorded',
      },
    })
  } catch (err: any) {
    console.error('[staff-matching] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
