#!/usr/bin/env node
/* Post-deploy smoke check for the CAREi API.
 *
 * Polls GET /health until routes are healthy or the deadline passes.
 * Exits 0 when status === 'ok' and routes.failed === 0; exits 1 otherwise
 * (or if the API is unreachable) — so CI and cron can alert on it.
 *
 * Usage:  node scripts/health-check.cjs [--url https://api.careiapp.com] [--timeout 300]
 */

const args = process.argv.slice(2)
const arg = (name, def) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : def
}

const BASE = arg('--url', process.env.API_URL || 'https://api.careiapp.com')
const DEADLINE_MS = parseInt(arg('--timeout', '300'), 10) * 1000
const POLL_MS = 15_000
const FETCH_TIMEOUT_MS = 10_000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function check() {
  const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
  const body = await res.json()
  const routes = body.routes || {}
  const failed = routes.failed ?? 0
  return {
    ok: body.status === 'ok' && failed === 0,
    reason: failed > 0 ? `${failed} routes failed: ${(routes.failedList || []).join(', ')}` : '',
    loaded: routes.loaded ?? 0,
    failed,
  }
}

async function main() {
  const deadline = Date.now() + DEADLINE_MS
  let attempt = 0
  let last = null

  while (Date.now() < deadline) {
    attempt++
    try {
      last = await check()
      if (last.ok) {
        console.log(`[health] OK — ${last.loaded} routes loaded, 0 failed (attempt ${attempt})`)
        return
      }
      console.log(`[health] attempt ${attempt}: ${last.reason}`)
    } catch (err) {
      console.log(`[health] attempt ${attempt}: ${err.message}`)
    }
    await sleep(POLL_MS)
  }

  console.error(`[health] FAIL — API did not become healthy within ${DEADLINE_MS / 1000}s`)
  if (last?.reason) console.error(`[health] last result: ${last.reason}`)
  process.exitCode = 1
}

main()
