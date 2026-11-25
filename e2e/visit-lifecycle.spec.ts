import { test, expect, request, APIRequestContext } from '@playwright/test'

/**
 * Full visit lifecycle against the production API (via vite proxy):
 *   manager login → create invite link → carer joins → manager schedules visit
 *   → carer clocks in (geo) → completes task → clocks out → submits handover
 *   → manager approves → family member sees the approved visit
 *
 * Creates real rows in prod (test carer, scheduled visit, family member) —
 * identifiable by the E2E- prefix for cleanup.
 */

const TENANT_SLUG = 'carei'
const TENANT_ID = 'tenant-carei'
const MANAGER = { email: 'onyedika.akoma@gmail.com', pin: '2660' }
const RUN = Date.now().toString(36)

async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; ctx?: APIRequestContext } = {}
) {
  const ctx = opts.ctx || (await request.newContext())
  const res = await ctx.fetch(`http://localhost:5173${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-slug': TENANT_SLUG,
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    data: opts.body as any,
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* non-json */ }
  return { status: res.status(), body: json }
}

test.describe('visit lifecycle', () => {
  test('invite → join → clock in → tasks → clock out → approve → family', async ({ page, context }) => {
    test.setTimeout(120_000)

    // ── 1. Manager login (API) ───────────────────────────────────
    const login = await api('POST', '/api/auth/login', { body: MANAGER })
    expect(login.status).toBe(200)
    const managerToken = login.body.token
    expect(managerToken).toBeTruthy()

    // ── 2. Create a one-use carer invite link ────────────────────
    const invite = await api('POST', '/api/invite-links', {
      token: managerToken,
      body: { tenantId: TENANT_ID, role: 'carer', label: `e2e-${RUN}`, maxUses: 1, expiresInHours: 1 },
    })
    expect(invite.status).toBe(201)
    const linkToken = invite.body.token as string

    // ── 3. Carer accepts the invite in the browser ───────────────
    const carerEmail = `e2e-carer-${RUN}@careiapp.com`
    await page.goto(`/join?link=${linkToken}`)
    await page.getByPlaceholder(/full name/i).fill(`E2E Carer ${RUN}`)
    await page.getByPlaceholder(/email address/i).fill(carerEmail)
    await page.getByPlaceholder(/choose a pin/i).fill('4321')
    await page.getByPlaceholder(/confirm pin/i).fill('4321')
    const [joinRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/invite-links') && r.request().method() === 'PATCH'
      ),
      page.getByRole('button', { name: /create account|join|continue/i }).click(),
    ])
    const joinBody = await joinRes.json()
    expect(joinRes.status(), JSON.stringify(joinBody)).toBe(200)
    const carerId = joinBody.user?.id as string
    expect(carerId, 'new carer id from join response').toBeTruthy()

    // Auto-login then redirect to the tenant dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })

    // ── 4. Manager schedules today's visit for the new carer ─────
    const clients = await api('GET', '/api/clients', { token: managerToken })
    const client = clients.body?.[0] || clients.body?.clients?.[0]
    expect(client, 'at least one client must exist').toBeTruthy()

    const schedId = `e2e-${RUN}`
    const today = new Date().toISOString().slice(0, 10)
    const sched = await api('POST', '/api/schedule', {
      token: managerToken,
      body: {
        id: schedId,
        clientId: client.id,
        clientName: client.name,
        carerId,
        carerName: `E2E Carer ${RUN}`,
        time: '09:00',
        duration: 60,
        tasks: ['E2E check vitals', 'E2E prepare meal'],
        visitDate: today,
      },
    })
    expect(sched.status).toBe(201)

    // ── 5. Carer starts the visit ────────────────────────────────
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 })

    await page.reload()
    await expect(page.getByText(client.name).first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /start visit/i }).first().click()

    // Client overview → second Start Visit creates the visit record
    const startBtn = page.getByRole('button', { name: /start visit/i })
    await expect(startBtn).toBeVisible({ timeout: 15_000 })
    await startBtn.click()
    await expect(page).toHaveURL(/\/visit\//, { timeout: 15_000 })
    const visitId = page.url().match(/\/visit\/([^/?#]+)/)?.[1]
    expect(visitId, 'visit id from url').toBeTruthy()

    // ── 6. Clock in (geo or override path) ───────────────────────
    await page.getByRole('button', { name: /^clock in$/i }).click()
    const overrideBtn = page.getByRole('button', { name: /clock in with override/i })
    if (await overrideBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await page.locator('select').selectOption({ index: 1 })
      await overrideBtn.click()
    }
    await expect(page.getByRole('button', { name: /clock out/i })).toBeVisible({ timeout: 15_000 })

    // ── 7. Complete a task ───────────────────────────────────────
    await page.getByText('E2E check vitals').click()

    // ── 8. Clock out → submit handover ───────────────────────────
    await page.getByRole('button', { name: /clock out/i }).click()
    await page.getByRole('button', { name: /confirm|clock out/i }).last().click()
    await expect(page).toHaveURL(/summary|dashboard/, { timeout: 15_000 })

    const submitBtn = page.getByRole('button', { name: /submit|finish|complete/i })
    if (await submitBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await submitBtn.click()
    }

    // ── 9. Visit shows as completed, pending approval (API) ──────
    await expect.poll(async () => {
      const pending = await api('GET', '/api/visit-approvals?status=pending', { token: managerToken })
      return (pending.body || []).some((v: any) => v.id === visitId)
    }, { timeout: 20_000 }).toBe(true)

    // ── 10. Manager approves ─────────────────────────────────────
    const approve = await api('PATCH', '/api/visit-approvals', {
      token: managerToken,
      body: { visitId, approvalStatus: 'approved' },
    })
    expect(approve.status).toBe(200)

    // ── 11. Family member sees the approved visit ────────────────
    const famInvite = await api('POST', '/api/family/members/invite', {
      token: managerToken,
      body: { name: `E2E Family ${RUN}`, email: `e2e-family-${RUN}@careiapp.com`, relationship: 'daughter', clientId: client.id },
    })
    expect(famInvite.status).toBe(200)
    const tempPin = famInvite.body.tempPin

    const famLogin = await api('POST', '/api/family/auth/login', {
      body: { email: `e2e-family-${RUN}@careiapp.com`, pin: tempPin },
    })
    expect(famLogin.status).toBe(200)
    const famToken = famLogin.body.token

    const famVisits = await api('GET', `/api/family/clients/${client.id}/visits`, { token: famToken })
    expect(famVisits.status).toBe(200)
    const visits = famVisits.body?.visits || famVisits.body || []
    expect(visits.some((v: any) => v.id === visitId), 'approved visit visible to family').toBe(true)

    // ── cleanup: remove the leftover scheduled_visits row ────────
    await api('DELETE', `/api/schedule?id=${schedId}`, { token: managerToken })
  })
})
