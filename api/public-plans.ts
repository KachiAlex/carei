import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  try {
    await ensureTables()
    const sql = getSql()

    const rows = await sql`
      SELECT slug, name, max_users, max_clients, price_per_carer, billing_model, is_default
      FROM plans
      ORDER BY max_users ASC
    ` as any[]

    res.status(200).json({ plans: rows })
  } catch (err: any) {
    console.error('[public-plans] error:', err)
    res.status(500).json({ error: err.message })
  }
}
