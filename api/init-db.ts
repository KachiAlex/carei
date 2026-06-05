import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, ensureTables } from './_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await ensureTables()
    res.status(200).json({ status: 'initialized' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
