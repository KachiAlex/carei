import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { neon } from '@neondatabase/serverless'

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(),
}))

// Import db helpers AFTER mocking the neon dependency
import {
  getTenantSlug,
  withTenant,
  verifyTenantAccess,
  getTenantFromSlug,
  getUserTenants,
} from './db.js'

const mockSql = vi.fn()

beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://mock'
})

function makeRes() {
  const json = vi.fn()
  const status = vi.fn(() => ({ json, end: vi.fn() }))
  return { status, json, end: vi.fn(), setHeader: vi.fn() } as any
}

function makeReq(overrides: any = {}): any {
  return {
    headers: {},
    query: {},
    url: '',
    method: 'GET',
    body: {},
    ...overrides,
  }
}

// ── getTenantSlug ──────────────────────────────────────
describe('getTenantSlug', () => {
  it('returns slug from X-Tenant-Slug header', () => {
    const req = makeReq({ headers: { 'x-tenant-slug': 'acme-care' } })
    expect(getTenantSlug(req)).toBe('acme-care')
  })

  it('returns slug from query param', () => {
    const req = makeReq({ query: { tenantSlug: 'beta-health' } })
    expect(getTenantSlug(req)).toBe('beta-health')
  })

  it('returns slug from URL path', () => {
    const req = makeReq({ url: '/api/tenant/gamma-ltd/clients' })
    expect(getTenantSlug(req)).toBe('gamma-ltd')
  })

  it('returns null when no slug provided', () => {
    expect(getTenantSlug(makeReq())).toBeNull()
  })
})

// ── withTenant middleware ───────────────────────────────
describe('withTenant middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSql.mockReset()
    ;(neon as any).mockReturnValue(mockSql)
  })

  it('returns 400 when tenant slug is missing', async () => {
    const req = makeReq()
    const res = makeRes()
    const handler = vi.fn()

    await withTenant(req, res, handler)

    expect(handler).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Tenant slug required') })
    )
  })

  it('returns 404 when tenant does not exist', async () => {
    mockSql.mockResolvedValue([])
    const req = makeReq({ headers: { 'x-tenant-slug': 'missing-tenant' } })
    const res = makeRes()
    const handler = vi.fn()

    await withTenant(req, res, handler)

    expect(handler).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Tenant not found' })
    )
  })

  it('returns 401 when auth token is missing', async () => {
    mockSql.mockResolvedValueOnce([{ id: 't-1', slug: 'acme', name: 'Acme' }])
    const req = makeReq({ headers: { 'x-tenant-slug': 'acme' } })
    const res = makeRes()
    const handler = vi.fn()

    await withTenant(req, res, handler)

    expect(handler).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Authentication required' })
    )
  })

  it('returns 403 when user has no access to tenant', async () => {
    const token = 'header.eyJ1c2VySWQiOiJ1LTEifQ==.sig'
    mockSql
      .mockResolvedValueOnce([{ id: 't-1', slug: 'acme', name: 'Acme' }])
      .mockResolvedValueOnce([])

    const req = makeReq({
      headers: { 'x-tenant-slug': 'acme', authorization: `Bearer ${token}` },
    })
    const res = makeRes()
    const handler = vi.fn()

    await withTenant(req, res, handler)

    expect(handler).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Access denied for this organization' })
    )
  })

  it('executes handler with tenant context when access is valid', async () => {
    const token = 'header.eyJ1c2VySWQiOiJ1LTEifQ==.sig'
    mockSql
      .mockResolvedValueOnce([{ id: 't-1', slug: 'acme', name: 'Acme' }])
      .mockResolvedValueOnce([{ role: 'admin' }])

    const req = makeReq({
      headers: { 'x-tenant-slug': 'acme', authorization: `Bearer ${token}` },
    })
    const res = makeRes()
    const handler = vi.fn()

    await withTenant(req, res, handler)

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't-1',
        userId: 'u-1',
        role: 'admin',
      })
    )
    expect(res.status).not.toHaveBeenCalledWith(403)
  })

  it('returns 500 for malformed token (catch-all error handling)', async () => {
    mockSql.mockResolvedValueOnce([{ id: 't-1', slug: 'acme', name: 'Acme' }])
    const req = makeReq({
      headers: { 'x-tenant-slug': 'acme', authorization: 'Bearer bad-token' },
    })
    const res = makeRes()
    const handler = vi.fn()

    await withTenant(req, res, handler)

    expect(handler).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })
})

// ── verifyTenantAccess ─────────────────────────────────
describe('verifyTenantAccess', () => {
  beforeEach(() => {
    mockSql.mockReset()
    ;(neon as any).mockReturnValue(mockSql)
  })

  it('returns hasAccess:true when user belongs to tenant', async () => {
    mockSql.mockResolvedValue([{ role: 'manager' }])
    const result = await verifyTenantAccess('u-1', 't-1')
    expect(result).toEqual({ role: 'manager', hasAccess: true })
    expect(mockSql).toHaveBeenCalledTimes(1)
  })

  it('returns hasAccess:false when user does not belong to tenant', async () => {
    mockSql.mockResolvedValue([])
    const result = await verifyTenantAccess('u-1', 't-99')
    expect(result).toEqual({ role: '', hasAccess: false })
  })
})

// ── getTenantFromSlug ──────────────────────────────────
describe('getTenantFromSlug', () => {
  beforeEach(() => {
    mockSql.mockReset()
    ;(neon as any).mockReturnValue(mockSql)
  })

  it('returns tenant when slug exists', async () => {
    mockSql.mockResolvedValue([{ id: 't-1', slug: 'acme', name: 'Acme Care' }])
    const result = await getTenantFromSlug('acme')
    expect(result).toEqual({ id: 't-1', slug: 'acme', name: 'Acme Care' })
  })

  it('returns null when slug does not exist', async () => {
    mockSql.mockResolvedValue([])
    const result = await getTenantFromSlug('unknown')
    expect(result).toBeNull()
  })
})

// ── getUserTenants ─────────────────────────────────────
describe('getUserTenants', () => {
  beforeEach(() => {
    mockSql.mockReset()
    ;(neon as any).mockReturnValue(mockSql)
  })

  it('returns all tenants for a user ordered by joined_at', async () => {
    mockSql.mockResolvedValue([
      { tenant_id: 't-2', slug: 'beta', name: 'Beta Health', role: 'carer' },
      { tenant_id: 't-1', slug: 'acme', name: 'Acme Care', role: 'admin' },
    ])
    const result = await getUserTenants('u-1')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ tenantId: 't-2', slug: 'beta', role: 'carer' })
    expect(result[1]).toMatchObject({ tenantId: 't-1', slug: 'acme', role: 'admin' })
  })

  it('returns empty array when user has no tenants', async () => {
    mockSql.mockResolvedValue([])
    const result = await getUserTenants('u-99')
    expect(result).toEqual([])
  })
})
