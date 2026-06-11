import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method === 'GET') {
    try {
      await ensureTables()
      const sql = getSql()
      const rows = await sql`SELECT * FROM clients ORDER BY name`
      const parsed = (rows as any[]).map((r) => ({
        ...r,
        conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : (r.conditions || []),
        medications: typeof r.medications === 'string' ? JSON.parse(r.medications) : (r.medications || []),
      }))
      res.status(200).json(parsed)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const { id, name, age, address, conditions, medications, preferences, emergencyContact, allergies, dysphagiaProtocol, supportFramework, communicationGuidance, mobility, careCues } = body
    if (!id || !name) {
      res.status(400).json({ error: 'id and name required' })
      return
    }
    try {
      await ensureTables()
      const sql = getSql()
      await sql`
        INSERT INTO clients (id, name, age, address, conditions, medications, preferences, emergency_contact, allergies, dysphagia_protocol, support_framework, communication_guidance, mobility, care_cues)
        VALUES (${id}, ${name}, ${age || null}, ${address || null}, ${JSON.stringify(conditions || [])}, ${JSON.stringify(medications || [])}, ${preferences || null}, ${emergencyContact || null}, ${allergies || null}, ${dysphagiaProtocol || null}, ${supportFramework || null}, ${communicationGuidance || null}, ${mobility || null}, ${JSON.stringify(careCues || null)})
      `
      res.status(201).json({ status: 'created', id })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
