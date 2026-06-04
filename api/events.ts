import type { VercelRequest, VercelResponse } from '@vercel/node'

const clients: VercelResponse[] = []

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  clients.push(res)

  res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`)

  req.on('close', () => {
    const idx = clients.indexOf(res)
    if (idx > -1) clients.splice(idx, 1)
  })
}

export function broadcast(data: unknown) {
  const msg = `data: ${JSON.stringify(data)}\n\n`
  clients.forEach((client) => {
    try { client.write(msg) } catch {}
  })
}
