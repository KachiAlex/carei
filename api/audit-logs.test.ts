import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { withTenant, logAuditEvent } from './db.js'

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(),
}))

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
    url: '/api/clients',
    method: 'GET',
    body: {},
    ...overrides,
  }
}

describe('audit logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSql.mockReset()
    ;(neon as any).mockReturnValue(mockSql)
  })

  it('logs cross_tenant_access_attempt on 403', async () => {
    const token = 'valid-token-123'
    mockSql
      .mockResolvedValueOnce([{ id: 't-1', slug: 'acme', name: 'Acme' }]) // getTenantFromSlug
      .mockResolvedValueOnce([{ id: 'u-1', name: 'Test', role: 'carer' }]) // getUserFromToken
      .mockResolvedValueOnce([]) // verifyTenantAccess
      .mockResolvedValueOnce([]) // logAuditEvent INSERT

    const req = makeReq({
      headers: { 'x-tenant-slug': 'acme', authorization: `Bearer ${token}` },
    })
    const res = makeRes()
    const handler = vi.fn()

    await withTenant(req, res, handler)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockSql).toHaveBeenCalledTimes(4)
    // Verify the audit log INSERT arguments include action and userId
    const insertCall = mockSql.mock.calls[3]
    const args = insertCall.slice(1) // skip template strings
    expect(args).toContain('cross_tenant_access_attempt')
    expect(args).toContain('u-1')
  })

  it('logs tenant_not_found on 404', async () => {
    mockSql
      .mockResolvedValueOnce([]) // getTenantFromSlug
      .mockResolvedValueOnce([]) // logAuditEvent INSERT

    const req = makeReq({ headers: { 'x-tenant-slug': 'missing' } })
    const res = makeRes()
    const handler = vi.fn()

    await withTenant(req, res, handler)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(mockSql).toHaveBeenCalledTimes(2)
    const insertCall = mockSql.mock.calls[1]
    const args = insertCall.slice(1)
    expect(args).toContain('tenant_not_found')
  })

  it('logAuditEvent inserts a row', async () => {
    mockSql.mockResolvedValueOnce([])

    await logAuditEvent({
      userId: 'u-1',
      tenantId: 't-1',
      action: 'test_action',
      resource: '/api/test',
      ipAddress: '1.2.3.4',
      statusCode: 200,
      details: { foo: 'bar' },
    })

    expect(mockSql).toHaveBeenCalledTimes(1)
    const call = mockSql.mock.calls[0]
    const args = call.slice(1)
    expect(args).toContain('test_action')
    expect(args).toContain('u-1')
    expect(args).toContain('t-1')
  })
})
