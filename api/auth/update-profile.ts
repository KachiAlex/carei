import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken } from '../db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'PATCH') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const { name, phone, region } = req.body || {}
  if (name === undefined && phone === undefined && region === undefined) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const userRows = await sql`SELECT id, name, email, phone, region, role FROM users WHERE token = ${token} LIMIT 1` as any[]
    const user = userRows[0]
    if (!user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    const updates: string[] = []
    if (name !== undefined) updates.push(`name = '${name.replace(/'/g, "''")}'`)
    if (phone !== undefined) updates.push(`phone = '${phone.replace(/'/g, "''")}'`)
    if (region !== undefined) updates.push(`region = '${region.replace(/'/g, "''")}'`)

    // Use raw query since we need dynamic column updates — but sanitize inputs
    await sql.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = '${user.id}'`)

    res.status(200).json({
      status: 'updated',
      user: {
        id: user.id,
        name: name !== undefined ? name : user.name,
        email: user.email,
        phone: phone !== undefined ? phone : user.phone,
        region: region !== undefined ? region : user.region,
        role: user.role,
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
