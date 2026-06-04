import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')
const sql = neon(connectionString)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  const clientId = Array.isArray(id) ? id[0] : id

  if (!clientId) {
    res.status(400).json({ error: 'Client ID required' })
    return
  }

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM clients WHERE id = ${clientId}`
      if (!rows[0]) {
        res.status(404).json({ error: 'Client not found' })
        return
      }
      res.status(200).json(rows[0])
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const body = req.body || {}
    const { name, age, address, conditions, medications, preferences, emergencyContact } = body
    try {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM clients WHERE id = ${clientId}`
      res.status(200).json({ status: 'deleted', id: clientId })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
