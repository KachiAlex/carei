import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

// Haversine distance in meters
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

// Estimate travel time from distance (assuming ~35 km/h average urban driving speed)
function estimateTravelTimeSeconds(distanceMeters: number): number {
  const avgSpeedMs = 35 * 1000 / 3600 // 35 km/h in m/s
  return Math.round(distanceMeters / avgSpeedMs)
}

// Try to geocode an address using Nominatim (OpenStreetMap)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || address.trim().length < 3) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=gb`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'carei-app/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch {}
  return null
}

// Try OSRM for road distance/time, fallback to haversine
async function getRouteInfo(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<{
  distanceMeters: number
  travelTimeSeconds: number
}> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      if (data.routes && data.routes[0]) {
        return {
          distanceMeters: Math.round(data.routes[0].distance),
          travelTimeSeconds: Math.round(data.routes[0].duration),
        }
      }
    }
  } catch {}
  // Fallback to haversine
  const dist = haversineMeters(from.lat, from.lng, to.lat, to.lng)
  return { distanceMeters: dist, travelTimeSeconds: estimateTravelTimeSeconds(dist) }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // ---- GET: Fetch travel logs for a carer/date range ----
    if (req.method === 'GET') {
      const { carerId, fromDate, toDate } = req.query as {
        carerId?: string
        fromDate?: string
        toDate?: string
      }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
          let rows
          if (carerId && fromDate && toDate) {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", from_client_id AS "fromClientId",
                from_client_name AS "fromClientName", from_address AS "fromAddress",
                to_client_id AS "toClientId", to_client_name AS "toClientName",
                to_address AS "toAddress", visit_date AS "visitDate",
                distance_meters AS "distanceMeters", travel_time_seconds AS "travelTimeSeconds",
                estimated_mode AS "estimatedMode", created_at AS "createdAt"
              FROM travel_logs
              WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
                AND visit_date >= ${fromDate} AND visit_date <= ${toDate}
              ORDER BY visit_date, created_at
            `
          } else if (carerId) {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", from_client_id AS "fromClientId",
                from_client_name AS "fromClientName", from_address AS "fromAddress",
                to_client_id AS "toClientId", to_client_name AS "toClientName",
                to_address AS "toAddress", visit_date AS "visitDate",
                distance_meters AS "distanceMeters", travel_time_seconds AS "travelTimeSeconds",
                estimated_mode AS "estimatedMode", created_at AS "createdAt"
              FROM travel_logs
              WHERE tenant_id = ${tenantId} AND carer_id = ${carerId}
              ORDER BY visit_date DESC, created_at DESC
              LIMIT 100
            `
          } else {
            rows = await tenantSql`
              SELECT id, carer_id AS "carerId", from_client_id AS "fromClientId",
                from_client_name AS "fromClientName", from_address AS "fromAddress",
                to_client_id AS "toClientId", to_client_name AS "toClientName",
                to_address AS "toAddress", visit_date AS "visitDate",
                distance_meters AS "distanceMeters", travel_time_seconds AS "travelTimeSeconds",
                estimated_mode AS "estimatedMode", created_at AS "createdAt"
              FROM travel_logs
              WHERE tenant_id = ${tenantId}
              ORDER BY visit_date DESC, created_at DESC
              LIMIT 200
            `
          }

          // Compute totals
          const totalDistance = (rows as any[]).reduce((sum, r) => sum + (r.distanceMeters || 0), 0)
          const totalTime = (rows as any[]).reduce((sum, r) => sum + (r.travelTimeSeconds || 0), 0)

          res.status(200).json({
            travelLogs: rows,
            totals: {
              distanceMeters: totalDistance,
              travelTimeSeconds: totalTime,
              distanceMiles: Math.round(totalDistance / 1609.34 * 10) / 10,
              travelTimeMinutes: Math.round(totalTime / 60),
            },
          })
        })
        return
      }
      res.status(200).json({ travelLogs: [], totals: { distanceMeters: 0, travelTimeSeconds: 0, distanceMiles: 0, travelTimeMinutes: 0 } })
      return
    }

    // ---- POST: Estimate travel between two addresses ----
    if (req.method === 'POST') {
      const body = req.body || {}
      const { action } = body

      // Estimate travel between two addresses
      if (action === 'estimate') {
        const { fromAddress, toAddress } = body
        if (!fromAddress || !toAddress) {
          res.status(400).json({ error: 'fromAddress and toAddress required' })
          return
        }

        const [from, to] = await Promise.all([
          geocodeAddress(fromAddress),
          geocodeAddress(toAddress),
        ])

        if (!from || !to) {
          res.status(200).json({
            estimated: false,
            reason: 'Could not geocode one or both addresses',
          })
          return
        }

        const route = await getRouteInfo(from, to)
        res.status(200).json({
          estimated: true,
          distanceMeters: route.distanceMeters,
          travelTimeSeconds: route.travelTimeSeconds,
          distanceMiles: Math.round(route.distanceMeters / 1609.34 * 10) / 10,
          travelTimeMinutes: Math.round(route.travelTimeSeconds / 60),
        })
        return
      }

      // Log a travel entry
      if (action === 'log') {
        const {
          carerId, fromClientId, fromClientName, fromAddress,
          toClientId, toClientName, toAddress, visitDate,
          distanceMeters, travelTimeSeconds, estimatedMode,
        } = body

        if (!carerId || !visitDate) {
          res.status(400).json({ error: 'carerId and visitDate required' })
          return
        }

        const id = 'travel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)

        if (tenantSlug) {
          await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
            await tenantSql`
              INSERT INTO travel_logs (
                id, tenant_id, carer_id, from_client_id, from_client_name, from_address,
                to_client_id, to_client_name, to_address, visit_date,
                distance_meters, travel_time_seconds, estimated_mode
              ) VALUES (
                ${id}, ${tenantId}, ${carerId},
                ${fromClientId || null}, ${fromClientName || null}, ${fromAddress || null},
                ${toClientId || null}, ${toClientName || null}, ${toAddress || null},
                ${visitDate},
                ${distanceMeters || null}, ${travelTimeSeconds || null}, ${estimatedMode || 'driving'}
              )
            `
            res.status(201).json({ status: 'logged', id })
          })
          return
        }
        await sql`
          INSERT INTO travel_logs (
            id, carer_id, from_client_id, from_client_name, from_address,
            to_client_id, to_client_name, to_address, visit_date,
            distance_meters, travel_time_seconds, estimated_mode
          ) VALUES (
            ${id}, ${carerId},
            ${fromClientId || null}, ${fromClientName || null}, ${fromAddress || null},
            ${toClientId || null}, ${toClientName || null}, ${toAddress || null},
            ${visitDate},
            ${distanceMeters || null}, ${travelTimeSeconds || null}, ${estimatedMode || 'driving'}
          )
        `
        res.status(201).json({ status: 'logged', id })
        return
      }

      // Batch estimate and log travel between consecutive visits
      if (action === 'batch') {
        const { visits, carerId, visitDate } = body
        if (!Array.isArray(visits) || visits.length < 2 || !carerId || !visitDate) {
          res.status(400).json({ error: 'visits (array, 2+), carerId, visitDate required' })
          return
        }

        const results: any[] = []
        for (let i = 0; i < visits.length - 1; i++) {
          const from = visits[i]
          const to = visits[i + 1]
          if (!from.address || !to.address) continue

          const [fromGeo, toGeo] = await Promise.all([
            geocodeAddress(from.address),
            geocodeAddress(to.address),
          ])

          if (!fromGeo || !toGeo) {
            results.push({ from: from.clientName, to: to.clientName, estimated: false })
            continue
          }

          const route = await getRouteInfo(fromGeo, toGeo)
          const id = 'travel_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 6)

          if (tenantSlug) {
            await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
              await tenantSql`
                INSERT INTO travel_logs (
                  id, tenant_id, carer_id, from_client_id, from_client_name, from_address,
                  to_client_id, to_client_name, to_address, visit_date,
                  distance_meters, travel_time_seconds, estimated_mode
                ) VALUES (
                  ${id}, ${tenantId}, ${carerId},
                  ${from.clientId || null}, ${from.clientName || null}, ${from.address},
                  ${to.clientId || null}, ${to.clientName || null}, ${to.address},
                  ${visitDate},
                  ${route.distanceMeters}, ${route.travelTimeSeconds}, 'driving'
                )
              `
            }).catch(() => {})
          }

          results.push({
            from: from.clientName,
            to: to.clientName,
            estimated: true,
            distanceMeters: route.distanceMeters,
            travelTimeSeconds: route.travelTimeSeconds,
            distanceMiles: Math.round(route.distanceMeters / 1609.34 * 10) / 10,
            travelTimeMinutes: Math.round(route.travelTimeSeconds / 60),
          })
        }

        const totalDistance = results.reduce((s, r) => s + (r.distanceMeters || 0), 0)
        const totalTime = results.reduce((s, r) => s + (r.travelTimeSeconds || 0), 0)

        res.status(200).json({
          results,
          totals: {
            distanceMeters: totalDistance,
            travelTimeSeconds: totalTime,
            distanceMiles: Math.round(totalDistance / 1609.34 * 10) / 10,
            travelTimeMinutes: Math.round(totalTime / 60),
          },
        })
        return
      }

      res.status(400).json({ error: 'Unknown action' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
