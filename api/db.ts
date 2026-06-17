import { neon } from '@neondatabase/serverless'

export function getSql() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL not set')
  return neon(connectionString)
}

let initPromise: Promise<void> | null = null

export async function ensureTables() {
  if (initPromise) return initPromise
  initPromise = runMigrations()
  return initPromise
}

async function runMigrations() {
  const sql = getSql()

  // Migration tracking table (always first)
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  const appliedRows = await sql`SELECT id FROM _migrations` as { id: number }[]
  const applied = new Set(appliedRows.map((r) => r.id))

  async function run(id: number, name: string, fn: () => Promise<void>) {
    if (applied.has(id)) return
    try {
      await fn()
      await sql`INSERT INTO _migrations (id, name) VALUES (${id}, ${name})`
    } catch (err: any) {
      console.error(`Migration ${id} (${name}) failed:`, err.message)
      throw err
    }
  }

  await run(1, 'core_tables', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS visits (
        id TEXT PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_age INTEGER,
        client_address TEXT,
        visit_time TEXT,
        visit_duration TEXT,
        elapsed INTEGER,
        tasks JSONB,
        fluid INTEGER,
        notes TEXT,
        medications JSONB,
        handover_note TEXT,
        clock_out_at TIMESTAMPTZ,
        bp_systolic INTEGER,
        bp_diastolic INTEGER,
        pulse INTEGER,
        o2_sat INTEGER,
        fluid_glasses INTEGER,
        meal_status TEXT,
        mood TEXT,
        wellbeing_note TEXT,
        clock_in_at TIMESTAMPTZ,
        status TEXT DEFAULT 'pending',
        submitted_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS sos_alerts (
        id TEXT PRIMARY KEY,
        visit_id TEXT,
        location TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        resolved BOOLEAN DEFAULT FALSE
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS scheduled_visits (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        client_name TEXT NOT NULL,
        carer_id TEXT,
        carer_name TEXT,
        time TEXT,
        duration TEXT,
        status TEXT DEFAULT 'pending',
        tasks JSONB,
        flags JSONB,
        recurring TEXT DEFAULT 'none',
        visit_date DATE DEFAULT CURRENT_DATE
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER,
        address TEXT,
        conditions JSONB,
        medications JSONB,
        preferences TEXT,
        emergency_contact TEXT,
        allergies TEXT,
        dysphagia_protocol TEXT,
        support_framework TEXT,
        communication_guidance TEXT,
        mobility TEXT,
        care_cues JSONB,
        bp_baseline_systolic INTEGER,
        bp_baseline_diastolic INTEGER
      )
    `
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS bp_baseline_systolic INTEGER`
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS bp_baseline_diastolic INTEGER`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS bp_systolic INTEGER`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS bp_diastolic INTEGER`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS pulse INTEGER`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS o2_sat INTEGER`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS fluid_glasses INTEGER`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS meal_status TEXT`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS mood TEXT`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS wellbeing_note TEXT`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS client_id TEXT`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS clock_in_at TIMESTAMPTZ`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'`
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        region TEXT NOT NULL,
        pin TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'carer',
        token TEXT,
        biometrics_enabled BOOLEAN DEFAULT FALSE,
        webauthn_credential JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`
    await sql`
      CREATE TABLE IF NOT EXISTS visit_drafts (
        visit_id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        visit_id TEXT,
        carer_id TEXT,
        carer_name TEXT,
        client_id TEXT,
        client_name TEXT,
        type TEXT NOT NULL,
        description TEXT,
        severity TEXT DEFAULT 'medium',
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        resolved BOOLEAN DEFAULT FALSE
      )
    `
    await sql`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS visit_id TEXT`
    await sql`
      CREATE TABLE IF NOT EXISTS voice_memos (
        id TEXT PRIMARY KEY,
        visit_id TEXT,
        carer_id TEXT,
        client_id TEXT,
        audio_url TEXT,
        duration INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS caregiver_client_assignments (
        id TEXT PRIMARY KEY,
        caregiver_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        visit_date DATE,
        visit_time TEXT,
        instructions TEXT,
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(caregiver_id, client_id)
      )
    `
    await sql`ALTER TABLE caregiver_client_assignments ADD COLUMN IF NOT EXISTS visit_date DATE`
    await sql`ALTER TABLE caregiver_client_assignments ADD COLUMN IF NOT EXISTS visit_time TEXT`
    await sql`ALTER TABLE caregiver_client_assignments ADD COLUMN IF NOT EXISTS instructions TEXT`
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        frequency TEXT DEFAULT 'daily',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS task_logs (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        caregiver_id TEXT NOT NULL,
        task_name TEXT NOT NULL,
        start_time TIMESTAMPTZ,
        complete_time TIMESTAMPTZ,
        notes TEXT,
        duration_minutes INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS medication_logs (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        caregiver_id TEXT,
        visit_id TEXT,
        medication_name TEXT NOT NULL,
        dose TEXT,
        administered_at TIMESTAMPTZ DEFAULT NOW(),
        status TEXT DEFAULT 'given',
        witness_name TEXT,
        reason TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS caregiver_id TEXT`
    await sql`ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS visit_id TEXT`
    await sql`ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS administered_at TIMESTAMPTZ DEFAULT NOW()`
    await sql`ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS witness_name TEXT`
    await sql`ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS notes TEXT`
    await sql`ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`
    try { await sql`ALTER TABLE medication_logs RENAME COLUMN carer_id TO caregiver_id` } catch {}
    try { await sql`ALTER TABLE medication_logs RENAME COLUMN timestamp TO administered_at` } catch {}
    await sql`
      CREATE TABLE IF NOT EXISTS body_map_marks (
        id TEXT PRIMARY KEY,
        visit_id TEXT NOT NULL,
        client_id TEXT,
        carer_id TEXT,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        side TEXT DEFAULT 'anterior',
        type TEXT DEFAULT 'skin_integrity',
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS pbs_framework JSONB`
    await sql`
      CREATE TABLE IF NOT EXISTS agencies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        logo TEXT,
        settings JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS approved_by TEXT`
    await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS family_read_at TIMESTAMPTZ`
    await sql`
      CREATE TABLE IF NOT EXISTS family_messages (
        id TEXT PRIMARY KEY,
        visit_id TEXT,
        client_id TEXT,
        sender_name TEXT,
        sender_role TEXT,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        purpose TEXT DEFAULT 'login',
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS drug_interactions (
        id TEXT PRIMARY KEY,
        drug_a TEXT NOT NULL,
        drug_b TEXT NOT NULL,
        severity TEXT DEFAULT 'moderate',
        description TEXT
      )
    `
  })

  await run(2, 'seed_drug_interactions', async () => {
    try {
      await sql`
        INSERT INTO drug_interactions (id, drug_a, drug_b, severity, description)
        VALUES
          ('di1', 'warfarin', 'aspirin', 'major', 'Increased bleeding risk — monitor INR closely'),
          ('di2', 'warfarin', 'ibuprofen', 'major', 'Increased bleeding risk — avoid or use acetaminophen'),
          ('di3', 'metformin', 'furosemide', 'moderate', 'May reduce metformin effectiveness — monitor glucose'),
          ('di4', 'lisinopril', 'spironolactone', 'major', 'Risk of hyperkalemia — monitor potassium levels'),
          ('di5', 'digoxin', 'furosemide', 'moderate', 'Hypokalemia increases digoxin toxicity risk'),
          ('di6', 'amiodarone', 'warfarin', 'major', 'Significantly potentiates anticoagulant effect'),
          ('di7', 'simvastatin', 'clarithromycin', 'major', 'Increased risk of rhabdomyolysis — consider alternative antibiotic'),
          ('di8', 'fluoxetine', 'tramadol', 'major', 'Serotonin syndrome risk — avoid combination if possible')
        ON CONFLICT (id) DO NOTHING
      `
    } catch { /* ignore */ }
  })

  await run(3, 'cleanup_mock_clients', async () => {
    try {
      await sql`DELETE FROM clients WHERE name IN ('Aisha Khan', 'Grace Mensah', 'Mary Johnson', 'Tom Adams')`
    } catch { /* ignore */ }
  })

  await run(4, 'performance_indexes', async () => {
    await sql`CREATE INDEX IF NOT EXISTS idx_visits_client_id ON visits(client_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_sos_alerts_visit ON sos_alerts(visit_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_sos_alerts_timestamp ON sos_alerts(timestamp)`
    await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_visits_carer ON scheduled_visits(carer_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_visits_date ON scheduled_visits(visit_date)`
    await sql`CREATE INDEX IF NOT EXISTS idx_medication_logs_client ON medication_logs(client_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_medication_logs_visit ON medication_logs(visit_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_incidents_visit ON incidents(visit_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_incidents_client ON incidents(client_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_voice_memos_visit ON voice_memos(visit_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_body_map_marks_visit ON body_map_marks(visit_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_family_messages_visit ON family_messages(visit_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_task_logs_client ON task_logs(client_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_caregiver_assignments_caregiver ON caregiver_client_assignments(caregiver_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_caregiver_assignments_client ON caregiver_client_assignments(client_id)`
  })

  await run(5, 'multi_tenant_support', async () => {
    // Create tenants table
    await sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        domain TEXT,
        plan TEXT DEFAULT 'trial',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Create tenant_users junction table
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'carer',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, user_id)
      )
    `

    // Add tenant_id to all existing tables
    const tables = [
      'clients', 'users', 'visits', 'scheduled_visits', 'sos_alerts',
      'incidents', 'voice_memos', 'caregiver_client_assignments', 'tasks',
      'task_logs', 'medication_logs', 'body_map_marks', 'family_messages',
      'visit_drafts', 'agencies', 'drug_interactions'
    ]

    for (const table of tables) {
      try {
        await sql`ALTER TABLE ${sql(table)} ADD COLUMN IF NOT EXISTS tenant_id TEXT`
      } catch { /* ignore if column exists */ }
    }

    // Create default tenant for existing data
    const defaultTenantId = 'default-tenant'
    await sql`
      INSERT INTO tenants (id, slug, name, plan)
      VALUES (${defaultTenantId}, 'default', 'Default Organization', 'professional')
      ON CONFLICT (id) DO NOTHING
    `

    // Migrate existing data to default tenant
    for (const table of tables) {
      try {
        await sql`UPDATE ${sql(table)} SET tenant_id = ${defaultTenantId} WHERE tenant_id IS NULL`
      } catch { /* ignore if table doesn't exist or no rows */ }
    }

    // Add indexes for tenant queries
    for (const table of tables) {
      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_${sql(table)}_tenant ON ${sql(table)}(tenant_id)`
      } catch { /* ignore */ }
    }

    await sql`CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id)`
  })

  await run(6, 'invites_table', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        code TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'carer',
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        used_by TEXT REFERENCES users(id),
        used_at TIMESTAMPTZ
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code)`
    await sql`CREATE INDEX IF NOT EXISTS idx_invites_tenant ON invites(tenant_id)`
  })

  await run(7, 'audit_logs_table', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        tenant_id TEXT,
        action TEXT NOT NULL,
        resource TEXT,
        ip_address TEXT,
        user_agent TEXT,
        status_code INTEGER,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`
  })
}

export function setCors(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function getAuthToken(req: any): string {
  const authHeader = req.headers?.authorization || ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/)
  if (bearerMatch) return bearerMatch[1]
  const cookie = req.headers?.cookie || ''
  const match = cookie.match(/carei_token=([^;]+)/)
  return match ? match[1] : ''
}

// Multi-tenant helpers
export function getTenantSlug(req: any): string | null {
  // Check header first (for API requests)
  const headerSlug = req.headers?.['x-tenant-slug']
  if (headerSlug) return headerSlug

  // Check query param
  const querySlug = req.query?.tenantSlug
  if (querySlug) return querySlug

  // Check URL path (for SSR/Vercel paths like /api/tenant/:slug/...)
  const path = req.url || ''
  const match = path.match(/\/tenant\/([^\/]+)/)
  if (match) return match[1]

  return null
}

export async function getTenantFromSlug(slug: string): Promise<{ id: string; slug: string; name: string } | null> {
  const sql = getSql()
  const rows = await sql`SELECT id, slug, name FROM tenants WHERE slug = ${slug}`
  return rows[0] as any || null
}

export async function logAuditEvent(data: {
  userId?: string
  tenantId?: string
  action: string
  resource?: string
  ipAddress?: string
  userAgent?: string
  statusCode?: number
  details?: any
}): Promise<void> {
  try {
    const sql = getSql()
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await sql`
      INSERT INTO audit_logs (id, user_id, tenant_id, action, resource, ip_address, user_agent, status_code, details)
      VALUES (
        ${id},
        ${data.userId || null},
        ${data.tenantId || null},
        ${data.action},
        ${data.resource || null},
        ${data.ipAddress || null},
        ${data.userAgent || null},
        ${data.statusCode || null},
        ${data.details ? JSON.stringify(data.details) : null}
      )
    `
  } catch (err: any) {
    console.error('Audit log error:', err.message)
  }
}

export async function getUserTenants(userId: string): Promise<Array<{ tenantId: string; slug: string; name: string; role: string }>> {
  const sql = getSql()
  const rows = await sql`
    SELECT t.id as tenant_id, t.slug, t.name, tu.role
    FROM tenant_users tu
    JOIN tenants t ON t.id = tu.tenant_id
    WHERE tu.user_id = ${userId}
    ORDER BY tu.joined_at DESC
  `
  return (rows as any[]).map(r => ({
    tenantId: r.tenant_id,
    slug: r.slug,
    name: r.name,
    role: r.role
  }))
}

export async function verifyTenantAccess(userId: string, tenantId: string): Promise<{ role: string; hasAccess: boolean }> {
  const sql = getSql()
  const rows = await sql`
    SELECT role FROM tenant_users
    WHERE user_id = ${userId} AND tenant_id = ${tenantId}
    LIMIT 1
  `
  if (rows.length === 0) return { role: '', hasAccess: false }
  return { role: (rows[0] as any).role, hasAccess: true }
}

export async function createTenant(data: { slug: string; name: string; domain?: string; plan?: string }): Promise<{ id: string }> {
  const sql = getSql()
  const id = `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await sql`
    INSERT INTO tenants (id, slug, name, domain, plan)
    VALUES (${id}, ${data.slug}, ${data.name}, ${data.domain || null}, ${data.plan || 'trial'})
  `
  return { id }
}

export async function addUserToTenant(userId: string, tenantId: string, role: string = 'carer'): Promise<void> {
  const sql = getSql()
  const id = `tu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await sql`
    INSERT INTO tenant_users (id, tenant_id, user_id, role)
    VALUES (${id}, ${tenantId}, ${userId}, ${role})
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = ${role}
  `
}

// Tenant-aware query helper - automatically filters by tenant_id
export async function tenantQuery(table: string, tenantId: string, action: 'select' | 'insert' | 'update' | 'delete', conditions?: Record<string, any>) {
  const sql = getSql()

  if (action === 'select') {
    const whereClause = Object.entries(conditions || {})
      .map(([key, val]) => sql`${sql(key)} = ${val}`)
      .join(' AND ')
    return sql`SELECT * FROM ${sql(table)} WHERE tenant_id = ${tenantId} ${whereClause ? sql`AND ${sql(whereClause)}` : sql``}`
  }

  // For insert, add tenant_id to data
  if (action === 'insert' && conditions) {
    const data = { ...conditions, tenant_id: tenantId }
    const columns = Object.keys(data).join(', ')
    const values = Object.values(data)
    return sql`INSERT INTO ${sql(table)} (${sql(columns)}) VALUES (${values})`
  }

  return null
}

// Tenant middleware for API endpoints
export async function withTenant(
  req: any,
  res: any,
  handler: (context: { tenantId: string; userId: string; role: string; sql: ReturnType<typeof getSql> }) => Promise<void>
): Promise<void> {
  const sql = getSql()

  // Extract tenant slug from request
  const tenantSlug = getTenantSlug(req)
  if (!tenantSlug) {
    res.status(400).json({ error: 'Tenant slug required. Provide via X-Tenant-Slug header or URL path.' })
    return
  }

  // Get tenant by slug
  const tenant = await getTenantFromSlug(tenantSlug)
  if (!tenant) {
    await logAuditEvent({
      action: 'tenant_not_found',
      resource: req.url,
      ipAddress: req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
      statusCode: 404,
      details: { slug: tenantSlug }
    })
    res.status(404).json({ error: 'Tenant not found' })
    return
  }

  // Extract user from token
  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    const userId = payload.userId

    if (!userId) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // Verify user has access to this tenant
    const access = await verifyTenantAccess(userId, tenant.id)
    if (!access.hasAccess) {
      await logAuditEvent({
        userId,
        tenantId: tenant.id,
        action: 'cross_tenant_access_attempt',
        resource: req.url,
        ipAddress: req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress,
        userAgent: req.headers?.['user-agent'],
        statusCode: 403,
        details: { method: req.method, slug: tenantSlug }
      })
      res.status(403).json({ error: 'Access denied for this organization' })
      return
    }

    // Execute handler with tenant context
    await handler({ tenantId: tenant.id, userId, role: access.role, sql })
  } catch (err: any) {
    console.error('Tenant middleware error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Simple in-memory rate limiter (resets every 60s, not persisted across cold starts)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(req: any, key: string, maxRequests: number, windowMs = 60000): { allowed: boolean; retryAfter?: number } {
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  const storeKey = `${clientIp}:${key}`
  const now = Date.now()
  const entry = rateLimitStore.get(storeKey)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(storeKey, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  entry.count++
  return { allowed: true }
}
