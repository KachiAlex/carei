import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, getAuthToken, getUserFromToken, getUserTenants, getTenantSlug } from './db.js'

// Authenticated, per-tenant SSE channels. EventSource can't set headers,
// so the token may also arrive as a ?token= query param.
const GLOBAL = '__global__'
const channels = new Map<string, Set<VercelResponse>>()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = getSql()
  const token = (req.query?.token as string) || getAuthToken(req)
  const user = token ? await getUserFromToken(sql, token) : null
  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const memberships = await getUserTenants(user.id)
  const wantedSlug = getTenantSlug(req)
  const tenant = wantedSlug ? memberships.find((t) => t.slug === wantedSlug) : memberships[0]
  const channel = tenant ? tenant.tenantId : GLOBAL

  setCors(req, res)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  let subscribers = channels.get(channel)
  if (!subscribers) {
    subscribers = new Set()
    channels.set(channel, subscribers)
  }
  subscribers.add(res)

  res.write(`data: ${JSON.stringify({ type: 'connected', tenantId: tenant ? tenant.tenantId : undefined, time: new Date().toISOString() })}\n\n`)

  const heartbeat = setInterval(() => {
    try {
      res.write(': hb\n\n')
    } catch {}
  }, 25_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    subscribers!.delete(res)
    if (subscribers!.size === 0) channels.delete(channel)
  })
}

export function broadcast(data: unknown, tenantId?: string) {
  const msg = `data: ${JSON.stringify(data)}\n\n`
  for (const client of channels.get(tenantId || GLOBAL) || []) {
    try {
      client.write(msg)
    } catch {}
  }
}
