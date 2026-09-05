import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const sql = getSql()

    const token = getAuthToken(req)
    if (!token) { res.status(401).json({ error: 'Authentication required' }); return }
    const user = await getUserFromToken(sql, token)
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return }
    if (user.role !== 'superadmin') { res.status(403).json({ error: 'Superadmin access required' }); return }

    // GET /api/plans
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, slug, name, max_users, max_clients, price_per_carer, billing_model, is_default, created_at, updated_at
        FROM plans
        ORDER BY max_users ASC
      ` as any[]
      res.status(200).json({ plans: rows })
      return
    }

    // PUT /api/plans — update existing plan
    if (req.method === 'PUT') {
      const { slug, name, max_users, max_clients, price_per_carer, billing_model } = req.body || {}
      if (!slug || !name || typeof max_users !== 'number' || typeof max_clients !== 'number') {
        res.status(400).json({ error: 'slug, name, max_users, max_clients required' })
        return
      }

      const planRows = await sql`SELECT id FROM plans WHERE slug = ${slug}` as any[]
      if (planRows.length === 0) {
        res.status(404).json({ error: 'Plan not found' })
        return
      }

      await sql`
        UPDATE plans
        SET name = ${name},
            max_users = ${max_users},
            max_clients = ${max_clients},
            price_per_carer = ${price_per_carer ?? 0},
            billing_model = ${billing_model || 'per-carer'},
            updated_at = NOW()
        WHERE slug = ${slug}
      `
      res.status(200).json({ message: 'Plan updated' })
      return
    }

    // POST /api/plans — create new plan
    if (req.method === 'POST') {
      const { slug, name, max_users, max_clients, price_per_carer, billing_model } = req.body || {}
      if (!slug || !name || typeof max_users !== 'number' || typeof max_clients !== 'number') {
        res.status(400).json({ error: 'slug, name, max_users, max_clients required' })
        return
      }

      const existing = await sql`SELECT id FROM plans WHERE slug = ${slug}` as any[]
      if (existing.length > 0) {
        res.status(409).json({ error: 'Plan with this slug already exists' })
        return
      }

      const id = `plan-${slug}`
      await sql`
        INSERT INTO plans (id, slug, name, max_users, max_clients, price_per_carer, billing_model, is_default)
        VALUES (${id}, ${slug}, ${name}, ${max_users}, ${max_clients}, ${price_per_carer ?? 0}, ${billing_model || 'per-carer'}, FALSE)
      `
      res.status(201).json({ message: 'Plan created', plan: { id, slug, name, max_users, max_clients, price_per_carer: price_per_carer ?? 0, billing_model: billing_model || 'per-carer' } })
      return
    }

    // DELETE /api/plans — delete plan
    if (req.method === 'DELETE') {
      const { slug } = req.body || req.query || {}
      if (!slug) {
        res.status(400).json({ error: 'slug required' })
        return
      }

      const planRows = await sql`SELECT id, is_default FROM plans WHERE slug = ${slug}` as any[]
      if (planRows.length === 0) {
        res.status(404).json({ error: 'Plan not found' })
        return
      }
      if (planRows[0].is_default) {
        res.status(400).json({ error: 'Cannot delete the default plan' })
        return
      }

      await sql`DELETE FROM plans WHERE slug = ${slug}`
      res.status(200).json({ message: 'Plan deleted' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[plans] error:', err)
    res.status(500).json({ error: err.message })
  }
}
