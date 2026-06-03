import type { VercelRequest, VercelResponse } from '@vercel/node'

// Mock visit data store (replace with database in production)
const visits: Record<string, any> = {}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  const visitId = Array.isArray(id) ? id[0] : id

  if (!visitId) {
    res.status(400).json({ error: 'Visit ID required' })
    return
  }

  if (req.method === 'GET') {
    const visit = visits[visitId] || { id: visitId, status: 'pending', data: null }
    res.status(200).json(visit)
    return
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    visits[visitId] = {
      ...visits[visitId],
      id: visitId,
      ...req.body,
      updatedAt: new Date().toISOString(),
    }
    res.status(200).json({ status: 'saved', visitId })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
