import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')
const sql = neon(connectionString)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM clients ORDER BY name`
      res.status(200).json(rows)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const { id, name, age, address, conditions, medications, preferences, emergencyContact } = body
    if (!id || !name) {
      res.status(400).json({ error: 'id and name required' })
      return
    }
    try {
      await sql`
        INSERT INTO clients (id, name, age, address, conditions, medications, preferences, emergency_contact)
        VALUES (${id}, ${name}, ${age || null}, ${address || null}, ${JSON.stringify(conditions || [])}, ${JSON.stringify(medications || [])}, ${preferences || null}, ${emergencyContact || null})
      `
      res.status(201).json({ status: 'created', id })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
