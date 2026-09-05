import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)

  if (!token) {
    res.status(401).json({ error: 'Missing token' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // Also return tenant membership so the frontend can avoid an extra /tenants call
    const tenantRows = await sql`
      SELECT t.id, t.slug, t.name, tu.role
      FROM tenant_users tu
      JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = ${user.id}
      ORDER BY t.name
    ` as any[]

    const tenants = tenantRows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      role: r.role,
    }))

    res.status(200).json({ user, tenants })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
