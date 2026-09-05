// CAREi db.js - Local PostgreSQL version
// Replaces Neon serverless driver with node-postgres (pg)
import pg from 'pg'
import { verifyToken } from './hash.js'

const { Pool } = pg
let _pool = null

function getPool() {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL not set')
    _pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return _pool
}

// Tagged template function that mimics Neon's sql tagged template
function makeSql(connectionString) {
  const pool = getPool()
  function sql(strings, ...values) {
    let query = strings[0]
    const params = []
    for (let i = 0; i < values.length; i++) {
      params.push(values[i])
      query += String.fromCharCode(36) + (i + 1) + strings[i + 1]
    }
    return pool.query(query, params).then(res => res.rows)
  }
  sql.query = async (text, values) => {
    const res = await pool.query(text, values)
    return res.rows
  }
  return sql
}

export function getSql() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL not set')
  return makeSql(connectionString)
}

export function getClient() {
  return getPool()
}

let initPromise = null

export async function ensureTables() {
  if (initPromise) return initPromise
  initPromise = runMigrations().catch((err) => {
    initPromise = null
    throw err
  })
  return initPromise
}

async function runMigrations() {
  const sql = getSql()
  await sql`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ DEFAULT NOW())`
  const appliedRows = await sql`SELECT id FROM _migrations`
  const applied = new Set(appliedRows.map((r) => r.id))

  async function run(id, name, fn) {
    if (applied.has(id)) return
    try {
      await fn()
      await sql`INSERT INTO _migrations (id, name) VALUES (${id}, ${name})`
    } catch (err) {
      console.error(`Migration ${id} (${name}) failed:`, err.message)
      throw err
    }
  }

  // Migrations are already applied from the Neon export
  // Just mark them as applied if not already
  // The actual table creation is handled by the schema import
}

// ─── Helper functions ───

export function setCors(req, res) {
  const origin = req.headers?.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Slug')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

export function getAuthToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  // Check cookies
  if (req.headers?.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
      const [k, v] = c.trim().split('=')
      acc[k] = v
      return acc
    }, {})
    if (cookies.carei_token) return cookies.carei_token
  }
  return null
}

export function getTenantSlug(req) {
  // From header
  if (req.headers?.['x-tenant-slug']) return req.headers['x-tenant-slug']
  if (req.query?.tenantSlug) return req.query.tenantSlug
  // From URL path /tenant/:slug/...
  const url = req.url || ''
  const match = url.match(/\/tenant\/([^\/]+)/)
  if (match) return match[1]
  return null
}

export async function getTenantFromSlug(slug) {
  const sql = getSql()
  const rows = await sql`SELECT * FROM tenants WHERE slug = ${slug} LIMIT 1`
  return rows[0] || null
}

export async function getUserFromToken(sql, token) {
  const hashedUsers = await sql`SELECT id, name, email, phone, region, role, token_hash, token_expires_at FROM users WHERE token_hash IS NOT NULL`
  for (const u of hashedUsers) {
    const valid = await verifyToken(token, u.token_hash)
    if (valid) {
      if (u.token_expires_at && new Date(u.token_expires_at) < new Date()) continue
      return { id: u.id, name: u.name, role: u.role, email: u.email }
    }
  }
  // Fallback: plaintext token during transition
  const rows = await sql`SELECT id, name, role, email FROM users WHERE token = ${token} LIMIT 1`
  return rows[0] ? { id: rows[0].id, name: rows[0].name, role: rows[0].role, email: rows[0].email } : null
}

export async function addUserToTenant(userId, tenantId, role = 'carer') {
  const sql = getSql()
  const id = `tu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await sql`INSERT INTO tenant_users (id, tenant_id, user_id, role) VALUES (${id}, ${tenantId}, ${userId}, ${role}) ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = ${role}`
}

export async function verifyTenantAccess(userId, tenantId) {
  const sql = getSql()
  const rows = await sql`SELECT role FROM tenant_users WHERE user_id = ${userId} AND tenant_id = ${tenantId} LIMIT 1`
  if (rows.length === 0) return { hasAccess: false, role: null }
  return { hasAccess: true, role: rows[0].role }
}

export async function logAuditEvent(data) {
  try {
    const sql = getSql()
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await sql`INSERT INTO audit_logs (id, user_id, tenant_id, action, resource, ip_address, user_agent, status_code, details) VALUES (${id}, ${data.userId || null}, ${data.tenantId || null}, ${data.action}, ${data.resource || null}, ${data.ipAddress || null}, ${data.userAgent || null}, ${data.statusCode || null}, ${data.details ? JSON.stringify(data.details) : null})`
  } catch (err) {
    console.error('Audit log error:', err.message)
  }
}

export async function getUserTenants(userId) {
  const sql = getSql()
  try {
    const rows = await sql`SELECT t.id as tenant_id, t.slug, t.name, tu.role FROM tenant_users tu JOIN tenants t ON t.id = tu.tenant_id WHERE tu.user_id = ${userId} ORDER BY tu.joined_at DESC`
    return rows.map(r => ({ tenantId: r.tenant_id, slug: r.slug, name: r.name, role: r.role }))
  } catch (err) {
    if (err.message?.includes('does not exist')) return []
    throw err
  }
}

export async function createTenant(data) {
  const sql = getSql()
  const id = `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await sql`INSERT INTO tenants (id, slug, name, domain, plan) VALUES (${id}, ${data.slug}, ${data.name}, ${data.domain || null}, ${data.plan || 'trial'})`
  return { id }
}

export async function getTenantMemberCount(tenantId) {
  const sql = getSql()
  const rows = await sql`SELECT COUNT(*) as count FROM tenant_users WHERE tenant_id = ${tenantId}`
  return parseInt(rows[0]?.count || '0', 10)
}

export async function getTenantClientCount(tenantId) {
  const sql = getSql()
  const rows = await sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ${tenantId}`
  return parseInt(rows[0]?.count || '0', 10)
}

export async function getTenantVisitCount(tenantId) {
  const sql = getSql()
  const rows = await sql`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ${tenantId}`
  return parseInt(rows[0]?.count || '0', 10)
}

export async function getTenantMembers(tenantId) {
  const sql = getSql()
  const rows = await sql`SELECT u.id, u.name, u.email, tu.role, tu.joined_at FROM tenant_users tu JOIN users u ON u.id = tu.user_id WHERE tu.tenant_id = ${tenantId} ORDER BY tu.joined_at DESC`
  return rows.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, joined_at: r.joined_at }))
}

export async function getTenantStats(tenantId) {
  const sql = getSql()
  const today = new Date().toISOString().split('T')[0]
  let user_count = 0, client_count = 0, visit_count = 0, active_today = 0
  try { const u = await sql`SELECT COUNT(*) as count FROM tenant_users WHERE tenant_id = ${tenantId}`; user_count = parseInt(u[0]?.count || '0', 10) } catch {}
  try { const c = await sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ${tenantId}`; client_count = parseInt(c[0]?.count || '0', 10) } catch {}
  try { const v = await sql`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ${tenantId}`; visit_count = parseInt(v[0]?.count || '0', 10) } catch {}
  try { const a = await sql`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ${tenantId} AND DATE(clock_in_at) = ${today}`; active_today = parseInt(a[0]?.count || '0', 10) } catch {}
  return { user_count, client_count, visit_count, active_today }
}

export async function getAllTenantsWithStats() {
  const sql = getSql()
  let tenantRows
  try {
    tenantRows = await sql`SELECT t.*, (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = t.id) as user_count, (SELECT COUNT(*) FROM clients WHERE tenant_id = t.id) as client_count, (SELECT COUNT(*) FROM visits WHERE tenant_id = t.id) as visit_count FROM tenants t ORDER BY t.created_at DESC`
  } catch {
    tenantRows = await sql`SELECT * FROM tenants ORDER BY created_at DESC`
  }
  const needsCounts = tenantRows.length > 0 && tenantRows[0].user_count === undefined
  if (needsCounts) {
    for (const t of tenantRows) {
      try { const u = await sql`SELECT COUNT(*) as count FROM tenant_users WHERE tenant_id = ${t.id}`; t.user_count = parseInt(u[0]?.count || '0', 10) } catch { t.user_count = 0 }
      try { const c = await sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ${t.id}`; t.client_count = parseInt(c[0]?.count || '0', 10) } catch { t.client_count = 0 }
      try { const v = await sql`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ${t.id}`; t.visit_count = parseInt(v[0]?.count || '0', 10) } catch { t.visit_count = 0 }
    }
  }
  return tenantRows.map(r => ({
    id: r.id, slug: r.slug, name: r.name, plan: r.plan,
    active: r.active ?? true, max_users: r.max_users ?? 3, max_clients: r.max_clients ?? 10,
    subscription_status: r.subscription_status ?? 'active',
    price_per_carer: r.price_per_carer ? parseFloat(r.price_per_carer) : null,
    billing_model: r.billing_model ?? 'per-carer',
    user_count: parseInt(r.user_count || '0', 10),
    client_count: parseInt(r.client_count || '0', 10),
    visit_count: parseInt(r.visit_count || '0', 10),
    created_at: r.created_at,
  }))
}

export function checkRateLimit(req, key, maxRequests, windowMs = 60000) {
  const clientIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  const storeKey = clientIp + ':' + key
  const now = Date.now()
  if (!rateLimitStore.has(storeKey) || now > rateLimitStore.get(storeKey).resetAt) {
    rateLimitStore.set(storeKey, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }
  const entry = rateLimitStore.get(storeKey)
  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count++
  return { allowed: true }
}

const rateLimitStore = new Map()

export async function withTenant(req, res, handler) {
  const sql = getSql()
  const tenantSlug = getTenantSlug(req)
  if (!tenantSlug) {
    res.status(400).json({ error: 'Tenant slug required.' })
    return
  }
  const tenant = await getTenantFromSlug(tenantSlug)
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' })
    return
  }
  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  const user = await getUserFromToken(sql, token)
  if (!user) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }
  const access = await verifyTenantAccess(user.id, tenant.id)
  if (!access.hasAccess) {
    res.status(403).json({ error: 'Access denied for this organization' })
    return
  }
  await handler({ tenantId: tenant.id, userId: user.id, role: access.role, sql })
}
