// Server-side push delivery helper.
//
// Sends to stored registration tokens via FCM legacy HTTP — works for
// Android (FCM token) and iOS when the app is configured for FCM.
// Set FCM_SERVER_KEY in the environment to enable delivery.
//
// iOS via raw APNs tokens requires APNs key auth — if the app registers
// APNs tokens instead of FCM, route iOS through Firebase or add an
// APNs JWT sender here (APNS_KEY_ID / APNS_TEAM_ID / APNS_AUTH_KEY).

import { getSql } from '../db.js'

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const serverKey = process.env.FCM_SERVER_KEY
  if (!serverKey) {
    console.warn('[push] FCM_SERVER_KEY not set — skipping delivery')
    return 0
  }

  const sql = getSql()
  const rows = await sql`
    SELECT token FROM push_tokens WHERE user_id = ${userId}
  ` as { token: string }[]
  const tokens = rows.map((r) => r.token)
  if (tokens.length === 0) return 0

  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${serverKey}`,
    },
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
