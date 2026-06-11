import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  const { id } = req.query
  const clientId = Array.isArray(id) ? id[0] : id

  if (!clientId) {
    res.status(400).json({ error: 'Client ID required' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM clients WHERE id = ${clientId}`
      if (!rows[0]) {
        res.status(404).json({ error: 'Client not found' })
        return
      }
      const r = rows[0] as any

      // Fetch most recent handover note for this client
      const lastVisit = await sql`
        SELECT handover_note, submitted_at
        FROM visits
        WHERE client_id = ${clientId} AND handover_note IS NOT NULL AND handover_note <> ''
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

    if (req.method === 'PATCH' || req.method === 'PUT') {
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
        WHERE id = ${clientId}
      `
      res.status(200).json({ status: 'updated', id: clientId })
      return
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM clients WHERE id = ${clientId}`
      res.status(200).json({ status: 'deleted', id: clientId })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
