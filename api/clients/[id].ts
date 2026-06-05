import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from '../../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
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
      res.status(200).json(rows[0])
      return
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = req.body || {}
      const { name, age, address, conditions, medications, preferences, emergencyContact } = body
      await sql`
        UPDATE clients SET
          name = COALESCE(${name || null}, name),
          age = COALESCE(${age ?? null}, age),
          address = COALESCE(${address || null}, address),
          conditions = COALESCE(${JSON.stringify(conditions || null)}, conditions),
          medications = COALESCE(${JSON.stringify(medications || null)}, medications),
          preferences = COALESCE(${preferences || null}, preferences),
          emergency_contact = COALESCE(${emergencyContact || null}, emergency_contact)
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
