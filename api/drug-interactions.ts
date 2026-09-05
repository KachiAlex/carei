import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()

    if (req.method === 'GET') {
      const drugsParam = req.query.drugs as string
      if (!drugsParam) {
        res.status(400).json({ error: 'drugs query param required (comma-separated)' })
        return
      }

      const drugs = drugsParam.split(',').map((d) => d.trim().toLowerCase())
      if (drugs.length < 2) {
        res.status(200).json({ interactions: [] })
        return
      }

      const pairs: any[] = []
      for (let i = 0; i < drugs.length; i++) {
        for (let j = i + 1; j < drugs.length; j++) {
          const a = drugs[i]
          const b = drugs[j]
          const rows = await sql`
            SELECT * FROM drug_interactions
            WHERE (LOWER(drug_a) = ${a} AND LOWER(drug_b) = ${b})
               OR (LOWER(drug_a) = ${b} AND LOWER(drug_b) = ${a})
          ` as any[]
          if (rows[0]) pairs.push(rows[0])
        }
      }

      res.status(200).json({ interactions: pairs })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
