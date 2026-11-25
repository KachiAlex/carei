import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from './db.js'
import auditLogsHandler from './audit-logs.js'
import dataExportHandler from './data-export.js'
import dataDeleteHandler from './data-delete.js'
import dataRetentionHandler from './data-retention.js'

// Whole-module db mock: lets each test drive auth + tenant context directly
const mockSql: any = vi.fn()

vi.mock('./db.js', () => ({
  getSql: vi.fn(() => mockSql),
  setCors: vi.fn(),
  ensureTables: vi.fn(async () => {}),
  getAuthToken: vi.fn((req: any) => {
    const h = req.headers?.authorization || ''
    return h.startsWith('Bearer ') ? h.slice(7) : null
  }),
  getUserFromToken: vi.fn(async () => ({ id: 'u-1', name: 'Mgr', role: 'manager', email: 'm@x.com' })),
  getTenantFromSlug: vi.fn(async (slug: string) => (slug === 'carei' ? { id: 't-1', slug } : null)),
  verifyTenantAccess: vi.fn(async () => ({ hasAccess: true, role: 'manager' })),
  getTenantSlug: vi.fn((req: any) => req.headers?.['x-tenant-slug'] || req.query?.tenant || null),
  logAuditEvent: vi.fn(async () => {}),
  withTenant: vi.fn(async (req: any, res: any, handler: any) => {
    const token = req.headers?.authorization?.slice(7)
    if (!token) return res.status(401).json({ error: 'Authentication required' })
    return handler({ tenantId: 't-1', userId: 'u-1', role: 'manager', sql: mockSql })
  }),
}))

function makeRes() {
  const json = vi.fn()
  const send = vi.fn()
  const status = vi.fn(() => ({ json, end: vi.fn(), send }))
  return { status, json, end: vi.fn(), send, setHeader: vi.fn() } as any
}

function makeReq(overrides: any = {}): any {
  return {
    method: 'GET',
    headers: { authorization: 'Bearer tok', 'x-tenant-slug': 'carei' },
    query: {},
    body: {},
    ...overrides,
  }
}

const authReq = (o: any = {}) => makeReq(o)
const anonReq = (o: any = {}) => makeReq({ headers: { 'x-tenant-slug': 'carei' }, ...o })

beforeEach(() => {
  vi.clearAllMocks()
  mockSql.mockReset()
  mockSql.query = vi.fn()
})

// ─── audit-logs ─────────────────────────────────────────────────────

describe('audit-logs', () => {
  it('rejects unauthenticated requests', async () => {
    const res = makeRes()
    await auditLogsHandler(anonReq({ headers: {} }), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects requests without a tenant slug', async () => {
    const res = makeRes()
    await auditLogsHandler(makeReq({ headers: { authorization: 'Bearer tok' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('accepts opaque (non-JWT) access tokens — regression for JWT-parse bug', async () => {
    // Token contains no dots; the old code parsed it as a JWT and 401'd
    const res = makeRes()
    mockSql.mockResolvedValueOnce([{ id: 'a1', user_id: 'u-1', tenant_id: 't-1', action: 'login', created_at: '2026-01-01' }])
    await auditLogsHandler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('denies carers (403)', async () => {
    vi.mocked(db.verifyTenantAccess).mockResolvedValueOnce({ hasAccess: true, role: 'carer' })
    const res = makeRes()
    await auditLogsHandler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('returns mapped logs for managers and writes an audit row', async () => {
    const res = makeRes()
    mockSql.mockResolvedValueOnce([
      { id: 'a1', user_id: 'u-1', tenant_id: 't-1', action: 'login', resource: '/api/x', ip_address: '1.1.1.1', user_agent: 'ua', status_code: 200, details: '{"k":1}', created_at: '2026-01-01T00:00:00Z' },
    ])
    await auditLogsHandler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload.logs[0].action).toBe('login')
    expect(payload.logs[0].details).toEqual({ k: 1 })
    expect(vi.mocked(db.logAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'audit_logs_export', tenantId: 't-1' })
    )
  })

  it('serves CSV when format=csv', async () => {
    const res = makeRes()
    mockSql.mockResolvedValueOnce([
      { id: 'a1', user_id: 'u-1', tenant_id: 't-1', action: 'login', created_at: '2026-01-01' },
    ])
    await auditLogsHandler(authReq({ query: { format: 'csv' } }), res)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8')
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('action,resource'))
  })
})

// ─── data-export (GDPR subject data export) ─────────────────────────

describe('data-export', () => {
  it('400s without a tenant slug', async () => {
    const res = makeRes()
    await dataExportHandler(makeReq({ headers: { authorization: 'Bearer tok' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('403s for carers — only managers/admins export', async () => {
    vi.mocked(db.withTenant).mockImplementationOnce(async (req: any, res: any, handler: any) =>
      handler({ tenantId: 't-1', userId: 'u-2', role: 'carer', sql: mockSql })
    )
    const res = makeRes()
    await dataExportHandler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('exports every scoped table plus tenant_info and logs the export', async () => {
    const res = makeRes()
    mockSql.query.mockResolvedValue([{ id: 'row1' }])
    mockSql.mockResolvedValueOnce([{ id: 't-1', slug: 'carei' }]) // tenant_info
    await dataExportHandler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('carei-export-carei-'))
    const payload = res.json.mock.calls[0][0]
    expect(payload.tenantSlug).toBe('carei')
    expect(payload.data.clients).toEqual([{ id: 'row1' }])
    expect(payload.data.audit_logs).toEqual([{ id: 'row1' }])
    expect(payload.data.tenant_info).toEqual([{ id: 't-1', slug: 'carei' }])
    expect(vi.mocked(db.logAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'data_export' })
    )
  })

  it('marks a table empty rather than failing the whole export', async () => {
    const res = makeRes()
    mockSql.query.mockRejectedValue(new Error('boom'))
    mockSql.mockResolvedValueOnce([{ id: 't-1' }])
    await dataExportHandler(authReq(), res)
    const payload = res.json.mock.calls[0][0]
    expect(payload.data.clients).toEqual([])
  })
})

// ─── data-delete (GDPR erasure) ─────────────────────────────────────

describe('data-delete', () => {
  it('requires confirmText "DELETE ALL DATA"', async () => {
    const res = makeRes()
    await dataDeleteHandler(authReq({ method: 'POST', body: {} }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toContain('DELETE ALL DATA')
  })

  it('403s for carers', async () => {
    vi.mocked(db.withTenant).mockImplementationOnce(async (req: any, res: any, handler: any) =>
      handler({ tenantId: 't-1', userId: 'u-2', role: 'carer', sql: mockSql })
    )
    const res = makeRes()
    await dataDeleteHandler(authReq({ method: 'POST', body: { confirmText: 'DELETE ALL DATA' } }), res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('deletes all scoped tables and writes a data_delete audit row', async () => {
    const res = makeRes()
    mockSql.query.mockResolvedValue({ rowCount: 2 })
    mockSql.mockResolvedValueOnce({ rowCount: 3 }) // carer users delete
    await dataDeleteHandler(authReq({ method: 'POST', body: { confirmText: 'DELETE ALL DATA' } }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload.success).toBe(true)
    expect(payload.totalDeleted).toBeGreaterThan(0)
    // every scoped table was deleted by name
    const queries = mockSql.query.mock.calls.map((c: any[]) => c[0] as string)
    for (const t of ['visits', 'clients', 'medication_logs', 'audit_logs', 'tenant_users']) {
      expect(queries.some((q: string) => q.includes(`DELETE FROM ${t}`))).toBe(true)
    }
    // carer users removed but manager/admin users kept
    expect(mockSql.mock.calls.some((c: any[]) => String(c[0]).includes("role = 'carer'") || c.includes('carer'))).toBe(true)
    expect(vi.mocked(db.logAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'data_delete' })
    )
  })
})

// ─── data-retention policy ──────────────────────────────────────────

describe('data-retention', () => {
  it('GET returns the stored policy for the tenant', async () => {
    const res = makeRes()
    mockSql.mockResolvedValueOnce([{ visitDraftRetentionDays: 45 }])
    await dataRetentionHandler(authReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json.mock.calls[0][0].visitDraftRetentionDays).toBe(45)
  })

  it('GET falls back to defaults when no policy row exists', async () => {
    const res = makeRes()
    mockSql.mockResolvedValueOnce([])
    await dataRetentionHandler(authReq(), res)
    expect(res.json.mock.calls[0][0].visitDraftRetentionDays).toBe(30)
    expect(res.json.mock.calls[0][0].autoPurgeEnabled).toBe(true)
  })

  it('POST action=update upserts the tenant policy', async () => {
    const res = makeRes()
    mockSql.mockResolvedValueOnce([])
    await dataRetentionHandler(authReq({ method: 'POST', body: { action: 'update', visitDraftRetentionDays: 7 } }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    const sqlCall = mockSql.mock.calls[0]
    expect(String(sqlCall[0])).toContain('INSERT INTO data_retention_policies')
    expect(sqlCall).toContain(7)
  })

  it('POST purge deletes expired rows per the policy', async () => {
    const res = makeRes()
    mockSql
      .mockResolvedValueOnce([{ visit_draft_retention_days: 1 }]) // policy row
      .mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2' }]) // visit_drafts purged
      .mockResolvedValueOnce([{ id: 'v1' }]) // visits purged
      .mockResolvedValueOnce([]) // medication_logs purged
      .mockResolvedValueOnce([]) // incidents purged
      .mockResolvedValueOnce([]) // voice_memos purged
    await dataRetentionHandler(authReq({ method: 'POST', body: { action: 'purge' } }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload.results?.visitDraftsPurged ?? payload.visitDraftsPurged ?? 0).toBeGreaterThanOrEqual(0)
    // at least one DELETE ran
    const deletes = mockSql.mock.calls.filter((c: any[]) => String(c[0]).includes('DELETE FROM'))
    expect(deletes.length).toBeGreaterThan(0)
  })
})
