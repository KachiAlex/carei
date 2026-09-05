import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import * as db from './db.js'
import handler from './bulk-invites.js'

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(),
}))

const mockSql = vi.fn()
const mockFetch = vi.fn()

beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://mock'
  globalThis.fetch = mockFetch
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
    url: '/api/bulk-invites',
    method: 'POST',
    body: {},
    ...overrides,
  }
}

describe('bulk invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSql.mockReset()
    mockFetch.mockReset()
    ;(neon as any).mockReturnValue(mockSql)
    vi.spyOn(db, 'ensureTables').mockResolvedValue(undefined as any)
  })

  it('creates invites from CSV and returns summary', async () => {
    const token = 'header.eyJ1c2VySWQiOiJ1LTEifQ==.sig'
    mockSql
      .mockResolvedValueOnce([{ role: 'admin' }]) // verifyTenantAccess
      .mockResolvedValueOnce([{ name: 'Acme' }]) // tenant name
      .mockResolvedValueOnce([]) // invite 1 insert
      .mockResolvedValueOnce([]) // invite 2 insert

    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) })

    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
      body: {
        tenantId: 't-1',
        csv: 'email,role\nalice@example.com,carer\nbob@example.com,manager',
      },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const response = res.json.mock.calls[0][0]
    expect(response.total).toBe(2)
    expect(response.created).toBe(2)
    expect(response.failed).toBe(0)
    expect(mockSql).toHaveBeenCalledTimes(4)
  })

  it('returns 403 for non-admin', async () => {
    const token = 'header.eyJ1c2VySWQiOiJ1LTEifQ==.sig'
    mockSql.mockResolvedValueOnce([{ role: 'carer' }]) // verifyTenantAccess

    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
      body: { tenantId: 't-1', csv: 'email\nalice@example.com' },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('reports invalid emails without failing entire batch', async () => {
    const token = 'header.eyJ1c2VySWQiOiJ1LTEifQ==.sig'
    mockSql
      .mockResolvedValueOnce([{ role: 'admin' }])
      .mockResolvedValueOnce([{ name: 'Acme' }])
      .mockResolvedValueOnce([])

    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
      body: {
        tenantId: 't-1',
        csv: 'email,role\nvalid@example.com,carer\nnot-an-email,carer',
      },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const response = res.json.mock.calls[0][0]
    expect(response.total).toBe(2)
    expect(response.created).toBe(1)
    expect(response.failed).toBe(1)
    expect(response.errors[0].error).toContain('Invalid email')
  })

  it('returns 400 when CSV header is missing email column', async () => {
    const token = 'header.eyJ1c2VySWQiOiJ1LTEifQ==.sig'
    mockSql.mockResolvedValueOnce([{ role: 'admin' }])

    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
      body: { tenantId: 't-1', csv: 'name,role\nAlice,carer' },
    })
    const res = makeRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('email') })
    )
  })
})
