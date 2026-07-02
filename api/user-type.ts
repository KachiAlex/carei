import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, getAuthToken, getUserFromToken } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  try {
    const { email } = req.query as { email?: string }
    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    const sql = getSql()
    
    // Check if user exists and get their role
    const users = await sql`
      SELECT id, role, created_at
      FROM users 
      WHERE email = ${email.toLowerCase()}
    ` as any[]

    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const user = users[0]
    
    // Check if user has biometric enabled (from secure storage would be ideal, but we can check if they have a recent token)
    const hasRecentToken = user.created_at && new Date(user.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000

    res.status(200).json({
      exists: true,
      isSuperAdmin: user.role === 'superadmin',
      emailVerified: true, // Auto-verify all accounts (email service pending)
      hasBiometric: hasRecentToken, // Simplified heuristic
      userId: user.id
    })

  } catch (err: any) {
    console.error('User type check error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
