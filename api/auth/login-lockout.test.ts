import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import * as db from '../db.js'
import loginHandler from './login.js'
import loginPasswordHandler from './login-password.js'
import resetPinHandler from './reset-pin.js'

vi.mock('@neondatabase/serverless', () => ({ neon: vi.fn() }))

vi.mock('../hash.js', () => ({
  hashCredential: vi.fn(async (s: string) => `hashed:${s}`),
  verifyCredential: vi.fn(async (cred: string, hash: string) => hash === `hashed:${cred}`),
  isLegacySHA256: vi.fn(() => false),
  generateSecureToken: vi.fn(() => 'tok'),
  tokenLookup: vi.fn(() => 'lookup'),
  hashToken: vi.fn(async () => 'hashed-tok'),
  verifyToken: vi.fn(async () => true),
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

function makeReq(body: any = {}, method = 'POST'): any {
  return { headers: {}, method, body }
}

const user = { id: 'u-1', email: 'a@b.com', pin_hash: 'hashed:1234', role: 'carer', status: 'active' }

beforeEach(() => {
  vi.clearAllMocks()
  mockSql.mockReset()
  ;(neon as any).mockReturnValue(mockSql)
  vi.spyOn(db, 'ensureTables').mockResolvedValue(undefined as any)
})

describe('checkAccountLock', () => {
  it('reports locked when locked_until is in the future', async () => {
    mockSql.mockResolvedValueOnce([{ locked_until: new Date(Date.now() + 60000).toISOString() }])
    const res = await db.checkAccountLock('a@b.com')
    expect(res.locked).toBe(true)
    expect(res.retryAfter).toBeGreaterThan(0)
  })

  it('reports unlocked when the lock has expired', async () => {
    mockSql.mockResolvedValueOnce([{ locked_until: new Date(Date.now() - 60000).toISOString() }])
    expect((await db.checkAccountLock('a@b.com')).locked).toBe(false)
  })

  it('reports unlocked when no row exists', async () => {
    mockSql.mockResolvedValueOnce([])
    expect((await db.checkAccountLock('a@b.com')).locked).toBe(false)
  })
})

describe('recordLoginFailure', () => {
  it('increments the failure counter', async () => {
    mockSql
      .mockResolvedValueOnce([{ failures: 2, locked_until: null }]) // SELECT
      .mockResolvedValueOnce([]) // upsert
    const res = await db.recordLoginFailure('a@b.com')
    expect(res.locked).toBe(false)
    const upsert = mockSql.mock.calls[1][0].join(' ')
    expect(upsert).toContain('login_attempts')
  })

  it('locks the account on the 5th consecutive failure', async () => {
    mockSql
      .mockResolvedValueOnce([{ failures: 4, locked_until: null }]) // SELECT → becomes 5
      .mockResolvedValueOnce([]) // lock upsert
    const res = await db.recordLoginFailure('a@b.com')
    expect(res.locked).toBe(true)
    expect(res.retryAfter).toBe(15 * 60)
  })

  it('does not bump the counter while still locked', async () => {
    mockSql.mockResolvedValueOnce([{ failures: 0, locked_until: new Date(Date.now() + 60000).toISOString() }])
    mockSql.mockResolvedValueOnce([]) // upsert writes same failures back
    const res = await db.recordLoginFailure('a@b.com')
    expect(res.locked).toBe(false)
  })
})

describe('PIN login handler — lockout wiring', () => {
  it('short-circuits 429 when the account is locked, before touching users', async () => {
    mockSql.mockResolvedValueOnce([{ locked_until: new Date(Date.now() + 300000).toISOString() }]) // lock SELECT
    const res = makeRes()
    await loginHandler(makeReq({ email: 'a@b.com', pin: '0000' }), res)
    expect(res.status).toHaveBeenCalledWith(429)
    expect(mockSql).toHaveBeenCalledTimes(1) // only the lock check ran
  })

  it('returns 429 (not 401) on the 5th bad PIN', async () => {
    mockSql
      .mockResolvedValueOnce([]) // checkAccountLock → not locked
      .mockResolvedValueOnce([user]) // users SELECT
      .mockResolvedValueOnce([]) // logSecurityEvent insert
      .mockResolvedValueOnce([{ failures: 4, locked_until: null }]) // recordLoginFailure SELECT
      .mockResolvedValueOnce([]) // lock upsert
    const res = makeRes()
    await loginHandler(makeReq({ email: 'a@b.com', pin: '9999' }), res)
    expect(res.status).toHaveBeenCalledWith(429)
  })

  it('returns 401 on a bad PIN under the threshold', async () => {
    mockSql
      .mockResolvedValueOnce([]) // checkAccountLock
      .mockResolvedValueOnce([user]) // users SELECT
      .mockResolvedValueOnce([]) // logSecurityEvent
      .mockResolvedValueOnce([{ failures: 1, locked_until: null }]) // recordLoginFailure SELECT
      .mockResolvedValueOnce([]) // upsert
    const res = makeRes()
    await loginHandler(makeReq({ email: 'a@b.com', pin: '9999' }), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('clears failures after a successful login', async () => {
    mockSql
      .mockResolvedValueOnce([]) // checkAccountLock
      .mockResolvedValueOnce([user]) // users SELECT
      .mockResolvedValueOnce([]) // clearLoginFailures DELETE
      .mockResolvedValue([]) // everything after
    const res = makeRes()
    await loginHandler(makeReq({ email: 'a@b.com', pin: '1234' }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    const deletes = mockSql.mock.calls.filter((c) => String(c[0]).includes('DELETE FROM login_attempts'))
    expect(deletes.length).toBeGreaterThan(0)
  })
})

describe('password login handler — shares the same account lock', () => {
  it('respects the lock set by PIN failures', async () => {
    mockSql.mockResolvedValueOnce([{ locked_until: new Date(Date.now() + 300000).toISOString() }])
    const res = makeRes()
    await loginPasswordHandler(makeReq({ email: 'a@b.com', password: 'x' }), res)
    expect(res.status).toHaveBeenCalledWith(429)
  })
})

describe('reset-pin handler — separate otp lock', () => {
  it('locks after repeated bad OTP codes', async () => {
    mockSql
      .mockResolvedValueOnce([]) // checkAccountLock 'otp' → not locked
      .mockResolvedValueOnce([]) // otp_codes SELECT → no match
      .mockResolvedValueOnce([{ failures: 4, locked_until: null }]) // recordLoginFailure SELECT
      .mockResolvedValueOnce([]) // lock upsert
    const res = makeRes()
    await resetPinHandler(makeReq({ email: 'a@b.com', newPin: '1234', otp: '000000' }), res)
    expect(res.status).toHaveBeenCalledWith(429)
  })
})
