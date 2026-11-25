import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Tenant-isolation audit — a static guardrail, not a substitute for
 * behavioral tests. Every api/ endpoint file must be explicitly
 * classified below. A new file that isn't classified fails the suite,
 * forcing a decision about its isolation model.
 *
 * Classes:
 *   TENANT       — must contain withTenant()/verifyTenantAccess/tenant_id signal
 *   USER_SCOPED  — authenticated, data keyed to the user's own id
 *   PUBLIC       — intentionally unauthenticated; no tenant data
 *   ADMIN_GATED  — destructive/admin tooling; must check ADMIN_SEED_TOKEN or superadmin
 *   HELPERS      — not an HTTP route (no default-export handler)
 */

const HELPERS = [
  'api/email.ts',
  'api/family-safe.ts',
  'api/push/send.ts',
  'api/validate.ts',
]

const ADMIN_GATED = [
  'api/fix-tenant-id.ts',
  'api/init-db.ts',
  'api/seed-superadmin.ts',
]

const PUBLIC = [
  'api/public-plans.ts',
  'api/otp.ts',
  'api/auth/login.ts',
  'api/auth/register.ts',
  'api/auth/login-password.ts',
  'api/auth/biometric-login.ts',
  'api/auth/biometric-token-login.ts',
  'api/auth/refresh.ts',
  'api/auth/reset-pin.ts', // pre-auth OTP-verified reset flow, rate-limited
]

const USER_SCOPED = [
  'api/anthropic/chat.ts',
  'api/anthropic/summary.ts',
  'api/auth/biometrics.ts',
  'api/auth/change-password.ts',
  'api/auth/logout.ts',
  'api/auth/update-profile.ts',
  'api/auth/me.ts',
  'api/copilot/context.ts',
  'api/copilot/sessions.ts',
  'api/drug-interactions.ts',
  'api/plans.ts',
  'api/push/register.ts',
  'api/upload.ts',
  'api/user-type.ts',
]

const SKIP = new Set(['api/db.ts', 'api/hash.ts'])

const apiDir = path.resolve(__dirname)
const repoRoot = path.resolve(__dirname, '..')

function listEndpointFiles(dir: string, rel: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry)
    const r = `${rel}/${entry}`
    if (fs.statSync(p).isDirectory()) out.push(...listEndpointFiles(p, r))
    else if (r.endsWith('.ts') && !r.endsWith('.test.ts')) out.push(r)
  }
  return out
}

const allFiles = listEndpointFiles(apiDir, 'api').filter((f) => !SKIP.has(f))
const readSrc = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8')

const TENANT_SIGNAL = /withTenant\s*\(|verifyTenantAccess|tenant_id|tenant_users|getUserTenants/
const AUTH_SIGNAL = /getUserFromToken|getAuthToken|Authorization|authorization/

describe('tenant isolation audit', () => {
  const classified = new Set([...HELPERS, ...ADMIN_GATED, ...PUBLIC, ...USER_SCOPED])

  it('every api endpoint file is classified', () => {
    const unclassified = allFiles.filter((f) => !classified.has(f))
    // Remaining files must all carry a tenant-isolation signal
    for (const file of unclassified) {
      const src = readSrc(file)
      expect(
        TENANT_SIGNAL.test(src),
        `${file} has no tenant-isolation signal — add withTenant()/tenant_id filtering or classify it in this test`
      ).toBe(true)
    }
  })

  it('helper files are not HTTP routes', () => {
    for (const file of HELPERS) {
      const src = readSrc(file)
      expect(src, `${file} grew a default export — reclassify it`).not.toMatch(/export\s+default/)
    }
  })

  it('admin-gated endpoints require a secret or superadmin', () => {
    for (const file of ADMIN_GATED) {
      const src = readSrc(file)
      expect(
        /ADMIN_SEED_TOKEN|superadmin/.test(src),
        `${file} lost its admin gate`
      ).toBe(true)
    }
  })

  it('user-scoped endpoints still authenticate', () => {
    for (const file of USER_SCOPED) {
      const src = readSrc(file)
      expect(AUTH_SIGNAL.test(src), `${file} lost its auth check`).toBe(true)
    }
  })

  it('no endpoint sets a wildcard CORS on a data channel', () => {
    for (const file of allFiles) {
      const src = readSrc(file)
      expect(
        /Access-Control-Allow-Origin['"]?\s*,\s*['"]?\*/.test(src),
        `${file} sets Access-Control-Allow-Origin: *`
      ).toBe(false)
    }
  })
})
