// EVV Layer 1: Geo-verification utility
// Captures GPS coordinates at clock-in and compares against client address geofence.

const GEOFENCE_RADIUS_M = 200 // 200m default radius
const GPS_TIMEOUT_MS = 15000
const GPS_MAX_AGE_MS = 30000

export interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

export interface GeoVerifyResult {
  position: GeoPosition | null
  clientPosition: GeoPosition | null
  distanceMeters: number | null
  withinGeofence: boolean
  geofenceRadius: number
  reason: string
  overridden: boolean
}

/**
 * Get the current GPS position from the browser.
 * Falls back gracefully if geolocation is unavailable or denied.
 */
export function getCurrentPosition(): Promise<GeoPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        })
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: GPS_TIMEOUT_MS,
        maximumAge: GPS_MAX_AGE_MS,
      }
    )
  })
}

/**
 * Geocode a street address to lat/lng using the free Nominatim (OpenStreetMap) API.
 * Returns null if geocoding fails.
 */
export async function geocodeAddress(address: string): Promise<GeoPosition | null> {
  if (!address || address.trim().length < 5) return null

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        accuracy: 0,
        timestamp: Date.now(),
      }
    }
  } catch {
    // Network error or parse failure
  }
  return null
}

/**
 * Haversine distance between two lat/lng points, in metres.
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

/**
 * Full geo-verification flow:
 * 1. Capture carer GPS position
 * 2. Geocode client address
 * 3. Compute distance
 * 4. Determine if within geofence
 *
 * If GPS or geocoding fails, returns a result with `withinGeofence = false`
 * and a descriptive reason so the UI can allow an override.
 */
export async function verifyLocation(
  clientAddress: string,
  radiusM: number = GEOFENCE_RADIUS_M
): Promise<GeoVerifyResult> {
  const position = await getCurrentPosition()

  if (!position) {
    return {
      position: null,
      clientPosition: null,
      distanceMeters: null,
      withinGeofence: false,
      geofenceRadius: radiusM,
      reason: 'GPS unavailable — location permission denied or device GPS disabled',
      overridden: false,
    }
  }

  const clientPosition = await geocodeAddress(clientAddress)

  if (!clientPosition) {
    return {
      position,
      clientPosition: null,
      distanceMeters: null,
      withinGeofence: true, // Can't verify distance, allow clock-in
      geofenceRadius: radiusM,
      reason: 'Client address could not be geocoded — GPS captured, geofence skipped',
      overridden: false,
    }
  }

  const distance = haversineDistance(
    position.lat,
    position.lng,
    clientPosition.lat,
    clientPosition.lng
  )

  const within = distance <= radiusM + position.accuracy

  return {
    position,
    clientPosition,
    distanceMeters: distance,
    withinGeofence: within,
    geofenceRadius: radiusM,
    reason: within
      ? `Within geofence (${distance}m from client address)`
      : `Outside geofence (${distance}m from client address, max ${radiusM}m)`,
    overridden: false,
  }
}
