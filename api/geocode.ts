import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug, getAuthToken, getUserFromToken } from './db.js'

/**
 * POST /api/geocode
 *   { address }                → geocode via Google, returns { lat, lng, formattedAddress }
 *   { clientId, address? }     → geocode + persist to clients.lat/lng (address defaults to client's)
 *
 * The Google key stays server-side (GOOGLE_MAPS_API_KEY env). Falls back to
 * Nominatim if the key is unset or Google errors, so EVV never hard-breaks.
 */

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export interface GeocodeResult {
  lat: number
  lng: number
  formattedAddress: string
  source: 'google' | 'nominatim'
}

export async function geocodeAddressGoogle(address: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!address || address.trim().length < 3 || !key) return null

  try {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&region=gb&key=${key}`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const data = await res.json() as any
    if (data.status === 'OK' && data.results?.[0]) {
      const loc = data.results[0].geometry.location
      return {
        lat: loc.lat,
        lng: loc.lng,
        formattedAddress: data.results[0].formatted_address,
        source: 'google',
      }
    }
    return null
  } catch {
    return null
  }
}

async function geocodeAddressNominatim(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim().length < 3) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=gb`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'carei-app/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name || address,
        source: 'nominatim',
      }
    }
  } catch {}
  return null
}

/** Google first, Nominatim fallback. */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  return (await geocodeAddressGoogle(address)) || (await geocodeAddressNominatim(address))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST' && req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  try {
    await ensureTables()
    const sql = getSql()

    const token = getAuthToken(req)
    if (!token) { res.status(401).json({ error: 'Not authenticated' }); return }
    const user = await getUserFromToken(sql, token)
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return }

    // GET ?address=... — lookup only, never persists
    if (req.method === 'GET') {
      const address = (req.query.address as string) || ''
      if (!address) { res.status(400).json({ error: 'address required' }); return }
      const geo = await geocodeAddress(address)
      if (!geo) { res.status(422).json({ error: 'Address could not be geocoded' }); return }
      res.status(200).json(geo)
      return
    }

    const { clientId, address } = req.body || {}

    const slug = getTenantSlug(req)
    if (slug) {
      await withTenant(req, res, async ({ sql: tenantSql, tenantId }) => {
        if (clientId) {
          let addr = address
          if (!addr) {
            const rows = await tenantSql`SELECT address FROM clients WHERE id = ${clientId} AND tenant_id = ${tenantId}` as any[]
            addr = rows[0]?.address
            if (!addr) { res.status(404).json({ error: 'Client not found or has no address' }); return }
          }
          const geo = await geocodeAddress(addr)
          if (!geo) { res.status(422).json({ error: 'Address could not be geocoded' }); return }
          await tenantSql`
            UPDATE clients SET lat = ${geo.lat}, lng = ${geo.lng},
              formatted_address = ${geo.formattedAddress}, geocoded_at = NOW()
            WHERE id = ${clientId} AND tenant_id = ${tenantId}
          `
          res.status(200).json({ ...geo, stored: true })
          return
        }
        if (!address) { res.status(400).json({ error: 'address or clientId required' }); return }
        const geo = await geocodeAddress(address)
        if (!geo) { res.status(422).json({ error: 'Address could not be geocoded' }); return }
        res.status(200).json(geo)
      })
      return
    }

    if (clientId) {
      let addr = address
      if (!addr) {
        const rows = await sql`SELECT address FROM clients WHERE id = ${clientId}` as any[]
        addr = rows[0]?.address
        if (!addr) { res.status(404).json({ error: 'Client not found or has no address' }); return }
      }
      const geo = await geocodeAddress(addr)
      if (!geo) { res.status(422).json({ error: 'Address could not be geocoded' }); return }
      await sql`
        UPDATE clients SET lat = ${geo.lat}, lng = ${geo.lng},
          formatted_address = ${geo.formattedAddress}, geocoded_at = NOW()
        WHERE id = ${clientId}
      `
      res.status(200).json({ ...geo, stored: true })
      return
    }
    if (!address) { res.status(400).json({ error: 'address or clientId required' }); return }
    const geo = await geocodeAddress(address)
    if (!geo) { res.status(422).json({ error: 'Address could not be geocoded' }); return }
    res.status(200).json(geo)
  } catch (err: any) {
    console.error('[geocode] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
