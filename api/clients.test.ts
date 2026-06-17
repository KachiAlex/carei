import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import clientsHandler from './clients.js'

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
    url: '',
    method: 'GET',
    body: {},
    ...overrides,
  }
}

describe('clients API tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSql.mockReset()
    ;(neon as any).mockReturnValue(mockSql)
  })

  it('lists only clients belonging to the tenant', async () => {
    const token = 'header.eyJ1c2VySWQiOiJ1LTEifQ==.sig'
    mockSql
      .mockResolvedValueOnce([{ id: 't-1', slug: 'acme', name: 'Acme' }])
      .mockResolvedValueOnce([{ role: 'admin' }])
      .mockResolvedValueOnce([
        { id: 'c-1', name: 'Alice', conditions: '[]', medications: '[]' },
      ])

    const req = makeReq({
      headers: { 'x-tenant-slug': 'acme', authorization: `Bearer ${token}` },
    })
    const res = makeRes()

    await clientsHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'c-1', name: 'Alice' }),
      ])
    )
    // Ensure tenant filter is applied
    const sqlCall = mockSql.mock.calls[2] // third call is the SELECT
    const template = sqlCall[0] as string[]
    expect(template.join('')).toContain('tenant_id')
  })

  it('returns 404 when client exists in another tenant', async () => {
    const token = 'header.eyJ1c2VySWQiOiJ1LTEifQ==.sig'
    mockSql
      .mockResolvedValueOnce([{ id: 't-1', slug: 'acme', name: 'Acme' }])
      .mockResolvedValueOnce([{ role: 'admin' }])
      .mockResolvedValueOnce([]) // no matching client in this tenant

    const req = makeReq({
      headers: { 'x-tenant-slug': 'acme', authorization: `Bearer ${token}` },
      query: { id: 'c-99' },
    })
    const res = makeRes()

    await clientsHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Client not found' })
    )
  })

  it('creates client scoped to tenant on POST', async () => {
    const token = 'header.eyJ1c2VySWQiOiJ1LTEifQ==.sig'
    mockSql
      .mockResolvedValueOnce([{ id: 't-1', slug: 'acme', name: 'Acme' }])
      .mockResolvedValueOnce([{ role: 'admin' }])
      .mockResolvedValueOnce([])

    const req = makeReq({
      method: 'POST',
      headers: { 'x-tenant-slug': 'acme', authorization: `Bearer ${token}` },
      body: { id: 'c-new', name: 'Bob' },
    })
    const res = makeRes()

    await clientsHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    const sqlCall = mockSql.mock.calls[2]
    const template = sqlCall[0] as string[]
    expect(template.join('')).toContain('tenant_id')
  })
})
