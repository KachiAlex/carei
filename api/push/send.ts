// Server-side push delivery helper.
//
// Android → FCM (legacy HTTP, needs FCM_SERVER_KEY).
// iOS     → APNs direct (JWT auth, needs APNs env vars below).
//
// Env vars:
//   FCM_SERVER_KEY   — Firebase Cloud Messaging legacy server key
//   APNS_KEY_ID      — 10-char key id from Apple Developer Keys
//   APNS_TEAM_ID     — 10-char Apple team id
//   APNS_AUTH_KEY    — full .p8 contents (or base64-encoded)
//   APNS_PRODUCTION  — 'true' for prod APNs, anything else = sandbox
// Bundle id is read from APNS_BUNDLE_ID, defaulting to com.carei.app.

import { getSql } from '../db.js'
import crypto from 'crypto'

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

const apnsJwtCache: { jwt: string; issuedAt: number } = { jwt: '', issuedAt: 0 }

function apnsJwt(): string {
  // APNs tokens are valid up to 60 min; refresh at 50
  if (apnsJwtCache.jwt && Date.now() - apnsJwtCache.issuedAt < 50 * 60 * 1000) {
    return apnsJwtCache.jwt
  }
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  let authKey = process.env.APNS_AUTH_KEY || ''
  if (!keyId || !teamId || !authKey) throw new Error('APNs env vars not configured')
  if (!authKey.includes('BEGIN')) authKey = Buffer.from(authKey, 'base64').toString('utf8')

  const b64url = (o: object | Buffer | string) =>
    Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
  const header = b64url({ alg: 'ES256', kid: keyId })
  const claims = b64url({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
  const unsigned = `${header}.${claims}`
  const signature = crypto.sign('sha256', Buffer.from(unsigned), authKey).toString('base64url')
  apnsJwtCache.jwt = `${unsigned}.${signature}`
  apnsJwtCache.issuedAt = Date.now()
  return apnsJwtCache.jwt
}

async function sendApns(tokens: string[], payload: PushPayload): Promise<number> {
  const host = process.env.APNS_PRODUCTION === 'true' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'
  const topic = process.env.APNS_BUNDLE_ID || 'com.carei.app'
  const jwt = apnsJwt()
  const body = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
    ...(payload.data || {}),
  })

  let sent = 0
  for (const token of tokens) {
    try {
      const res = await fetch(`https://${host}/3/device/${token}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${jwt}`,
          'apns-topic': topic,
          'apns-push-type': 'alert',
          'content-type': 'application/json',
        },
        body,
      })
      if (res.status === 200) {
        sent++
      } else if (res.status === 410 || res.status === 400) {
        // Token dead — remove it so we stop retrying
        const sql = getSql()
        await sql`DELETE FROM push_tokens WHERE token = ${token}`
      } else {
        console.error('[push] APNs error:', res.status, await res.text())
      }
    } catch (err) {
      console.error('[push] APNs send failed:', err)
    }
  }
  return sent
}

async function sendFcm(tokens: string[], payload: PushPayload): Promise<number> {
  const serverKey = process.env.FCM_SERVER_KEY
  if (!serverKey) {
    console.warn('[push] FCM_SERVER_KEY not set — skipping Android delivery')
    return 0
  }
  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `key=${serverKey}` },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
    }),
  })
  if (!res.ok) {
    console.error('[push] FCM send failed:', res.status, await res.text())
    return 0
  }
  const result = (await res.json()) as { success?: number }
  return result.success || 0
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const sql = getSql()
  const rows = await sql`
    SELECT token, platform FROM push_tokens WHERE user_id = ${userId}
  ` as { token: string; platform: string }[]
  if (rows.length === 0) return 0

  const apnsTokens = rows.filter((r) => r.platform === 'ios').map((r) => r.token)
  const fcmTokens = rows.filter((r) => r.platform !== 'ios').map((r) => r.token)

  let sent = 0
  if (apnsTokens.length) {
    try {
      sent += await sendApns(apnsTokens, payload)
    } catch (err) {
      console.error('[push] APNs unavailable:', err)
    }
  }
  if (fcmTokens.length) sent += await sendFcm(fcmTokens, payload)
  return sent
}
