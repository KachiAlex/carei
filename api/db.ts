import { neon, Client } from '@neondatabase/serverless'

export function getSql() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL not set')
  return neon(connectionString)
}

export function getClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL not set')
  return new Client(connectionString)
}

let initPromise: Promise<void> | null = null

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

    // Add tenant_id to all existing tables (use raw SQL strings — table names cannot be parameters)
    for (const table of tables) {
      try {
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id TEXT`)
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
        await sql.query(`UPDATE ${table} SET tenant_id = '${defaultTenantId}' WHERE tenant_id IS NULL`)
      } catch { /* ignore if table doesn't exist or no rows */ }
    }

    // Add indexes for tenant queries
    for (const table of tables) {
      try {
        await sql.query(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`)
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

  await run(8, 'password_hash_column', async () => {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`
  })

  await run(9, 'tenant_licensing_fields', async () => {
    await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_users INTEGER`
    await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_clients INTEGER`
    await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`
    await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`
    await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active'`
    // Set sensible defaults based on existing plan
    await sql`UPDATE tenants SET max_users = 3 WHERE plan = 'trial' AND max_users IS NULL`
    await sql`UPDATE tenants SET max_users = 15 WHERE plan = 'professional' AND max_users IS NULL`
    await sql`UPDATE tenants SET max_users = 100 WHERE plan = 'enterprise' AND max_users IS NULL`
    await sql`UPDATE tenants SET max_users = 3 WHERE max_users IS NULL`
    await sql`UPDATE tenants SET max_clients = 10 WHERE plan = 'trial' AND max_clients IS NULL`
    await sql`UPDATE tenants SET max_clients = 100 WHERE plan = 'professional' AND max_clients IS NULL`
    await sql`UPDATE tenants SET max_clients = 500 WHERE plan = 'enterprise' AND max_clients IS NULL`
    await sql`UPDATE tenants SET max_clients = 10 WHERE max_clients IS NULL`
  })

  await run(10, 'ensure_tenant_id_columns', async () => {
    // Create default tenant for backfill
    const defaultTenantId = 'default-tenant'
    await sql`
      INSERT INTO tenants (id, slug, name, plan)
      VALUES (${defaultTenantId}, 'default', 'Default Organization', 'professional')
      ON CONFLICT (id) DO NOTHING
    `
    // Add tenant_id to all core tables
    const tables = [
      'clients', 'users', 'visits', 'scheduled_visits', 'sos_alerts',
      'incidents', 'voice_memos', 'caregiver_client_assignments', 'tasks',
      'task_logs', 'medication_logs', 'body_map_marks', 'family_messages',
      'visit_drafts', 'agencies', 'drug_interactions'
    ]
    for (const table of tables) {
      try {
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id TEXT`)
      } catch { /* ignore */ }
    }
    // Backfill existing rows with default tenant
    for (const table of tables) {
      try {
        await sql.query(`UPDATE ${table} SET tenant_id = '${defaultTenantId}' WHERE tenant_id IS NULL`)
      } catch { /* ignore */ }
    }
    // Ensure indexes exist
    for (const table of tables) {
      try {
        await sql.query(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`)
      } catch { /* ignore */ }
    }
  })

  await run(11, 'fix_missing_tenant_id_columns', async () => {
    // Recovery migration: previous migrations 5 and 10 used invalid dynamic SQL
    // (${sql.query(table)}) which produced broken queries. The errors were
    // swallowed by try/catch, so tenant_id was never actually added to core tables.
    const tables = [
      'clients', 'users', 'visits', 'scheduled_visits', 'sos_alerts',
      'incidents', 'voice_memos', 'caregiver_client_assignments', 'tasks',
      'task_logs', 'medication_logs', 'body_map_marks', 'family_messages',
      'visit_drafts', 'agencies', 'drug_interactions'
    ]
    for (const table of tables) {
      try {
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id TEXT`)
      } catch { /* ignore if table doesn't exist or column already exists */ }
    }
    // Backfill any NULL tenant_ids with default tenant
    for (const table of tables) {
      try {
        await sql.query(`UPDATE ${table} SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL`)
      } catch { /* ignore */ }
    }
    // Create indexes
    for (const table of tables) {
      try {
        await sql.query(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`)
      } catch { /* ignore */ }
    }
  })

  await run(12, 'ensure_tenant_id_columns_v2', async () => {
    // Migration 11 was already marked as applied in the database but the code
    // that ran at that time still had the broken dynamic SQL. This migration
    // ensures the columns actually get created.
    const tables = [
      'clients', 'users', 'visits', 'scheduled_visits', 'sos_alerts',
      'incidents', 'voice_memos', 'caregiver_client_assignments', 'tasks',
      'task_logs', 'medication_logs', 'body_map_marks', 'family_messages',
      'visit_drafts', 'agencies', 'drug_interactions'
    ]
    for (const table of tables) {
      try {
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id TEXT`)
      } catch { /* ignore if table doesn't exist or column already exists */ }
    }
    for (const table of tables) {
      try {
        await sql.query(`UPDATE ${table} SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL`)
      } catch { /* ignore */ }
    }
    for (const table of tables) {
      try {
        await sql.query(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`)
      } catch { /* ignore */ }
    }
  })

  await run(13, 'link_orphaned_users_to_carei', async () => {
    // Find or create the 'carei' tenant
    let careiRows = await sql`SELECT id FROM tenants WHERE slug = 'carei' LIMIT 1` as any[]
    let careiTenantId = careiRows[0]?.id
    if (!careiTenantId) {
      careiTenantId = 'tenant-carei'
      await sql`
        INSERT INTO tenants (id, slug, name, plan)
        VALUES (${careiTenantId}, 'carei', 'Carei', 'professional')
        ON CONFLICT (slug) DO NOTHING
      `
      const t = await sql`SELECT id FROM tenants WHERE slug = 'carei' LIMIT 1` as any[]
      careiTenantId = t[0]?.id
    }
    if (!careiTenantId) return

    // Link all users not in tenant_users to the carei tenant
    const orphaned = await sql`
      SELECT u.id, u.role FROM users u
      LEFT JOIN tenant_users tu ON u.id = tu.user_id
      WHERE tu.user_id IS NULL
    ` as any[]

    for (const user of orphaned) {
      const tuId = 'tu-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
      await sql`
        INSERT INTO tenant_users (id, tenant_id, user_id, role)
        VALUES (${tuId}, ${careiTenantId}, ${user.id}, ${user.role || 'carer'})
        ON CONFLICT (tenant_id, user_id) DO NOTHING
      `
    }

    // Backfill users.tenant_id
    const client = getClient()
    await client.connect()
    try {
      await client.query(`UPDATE users SET tenant_id = '${careiTenantId}' WHERE tenant_id IS NULL OR tenant_id = ''`)
    } finally {
      await client.end()
    }
  })

  await run(14, 'create_tenant_id_columns_with_client', async () => {
    // Previous migrations 10-12 used broken dynamic SQL that silently failed
    // with @neondatabase/serverless v1.1.0 (neon() only supports tagged templates).
    const client = getClient()
    await client.connect()
    try {
      const tables = [
        'clients', 'users', 'visits', 'scheduled_visits', 'sos_alerts',
        'incidents', 'voice_memos', 'caregiver_client_assignments', 'tasks',
        'task_logs', 'medication_logs', 'body_map_marks', 'family_messages',
        'visit_drafts', 'agencies', 'drug_interactions'
      ]
      for (const table of tables) {
        try {
          await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id TEXT`)
        } catch { /* ignore if table doesn't exist or column already exists */ }
        try {
          await client.query(`UPDATE ${table} SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL`)
        } catch { /* ignore */ }
        try {
          await client.query(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`)
        } catch { /* ignore */ }
      }
    } finally {
      await client.end()
    }
  })

  await run(15, 'fix_clients_missing_columns', async () => {
    // Some columns were missing from clients table causing 500 on create
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergies TEXT`
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS dysphagia_protocol TEXT`
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS support_framework TEXT`
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS communication_guidance TEXT`
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS mobility TEXT`
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS care_cues JSONB`
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS bp_baseline_systolic INTEGER`
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS bp_baseline_diastolic INTEGER`
  })

  await run(16, 'composite_indexes_for_tenant_queries', async () => {
    // Composite indexes for the most common tenant-scoped queries
    await sql`CREATE INDEX IF NOT EXISTS idx_visits_tenant_status ON visits(tenant_id, status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_visits_tenant_submitted ON visits(tenant_id, submitted_at DESC)`
    await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_visits_tenant_carer_date ON scheduled_visits(tenant_id, carer_id, visit_date)`
    await sql`CREATE INDEX IF NOT EXISTS idx_caregiver_assignments_tenant_caregiver ON caregiver_client_assignments(tenant_id, caregiver_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_incidents_tenant_resolved ON incidents(tenant_id, resolved)`
    await sql`CREATE INDEX IF NOT EXISTS idx_sos_alerts_tenant_resolved ON sos_alerts(tenant_id, resolved)`
    await sql`CREATE INDEX IF NOT EXISTS idx_task_logs_tenant_client ON task_logs(tenant_id, client_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_medication_logs_tenant_client ON medication_logs(tenant_id, client_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_body_map_marks_tenant_visit ON body_map_marks(tenant_id, visit_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_family_messages_tenant_client ON family_messages(tenant_id, client_id)`
  })

  // Safety net: ensure multi-tenant tables exist even if migration tracking was inconsistent
  await sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      domain TEXT,
      plan TEXT DEFAULT 'trial',
      max_users INTEGER,
      max_clients INTEGER,
      active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMPTZ,
      subscription_status TEXT DEFAULT 'active',
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
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
  await sql`CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id)`
}

export function setCors(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Slug')
}

export function getAuthToken(req: any): string {
  const authHeader = req.headers?.authorization || ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/)
  if (bearerMatch) return bearerMatch[1]
  const cookie = req.headers?.cookie || ''
  const match = cookie.match(/carei_token=([^;]+)/)
  return match ? match[1] : ''
}

export async function getUserFromToken(sql: any, token: string): Promise<{ id: string; name: string; role: string } | null> {
  const rows = await sql`SELECT id, name, role FROM users WHERE token = ${token} LIMIT 1` as any[]
  return rows[0] || null
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
  try {
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
  } catch (err: any) {
    if (err.message?.includes('relation "tenant_users" does not exist') || err.message?.includes('relation "tenants" does not exist')) {
      return []
    }
    throw err
  }
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

export async function getTenantMemberCount(tenantId: string): Promise<number> {
  const sql = getSql()
  const rows = await sql`SELECT COUNT(*) as count FROM tenant_users WHERE tenant_id = ${tenantId}` as any[]
  return parseInt(rows[0]?.count || '0', 10)
}

export async function getTenantClientCount(tenantId: string): Promise<number> {
  const sql = getSql()
  const rows = await sql`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ${tenantId}` as any[]
  return parseInt(rows[0]?.count || '0', 10)
}

export async function getTenantVisitCount(tenantId: string): Promise<number> {
  const sql = getSql()
  const rows = await sql`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ${tenantId}` as any[]
  return parseInt(rows[0]?.count || '0', 10)
}

export async function getTenantMembers(tenantId: string): Promise<Array<{ id: string; name: string; email: string; role: string; joined_at: string }>> {
  const sql = getSql()
  const rows = await sql`
    SELECT u.id, u.name, u.email, tu.role, tu.joined_at
    FROM tenant_users tu
    JOIN users u ON u.id = tu.user_id
    WHERE tu.tenant_id = ${tenantId}
    ORDER BY tu.joined_at DESC
  ` as any[]
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    joined_at: r.joined_at,
  }))
}

export async function getTenantStats(tenantId: string): Promise<{
  user_count: number
  client_count: number
  visit_count: number
  active_today: number
}> {
  const sql = getSql()

  const safeCount = async (table: string, whereClause?: string): Promise<number> => {
    try {
      const query = whereClause
        ? `SELECT COUNT(*) as count FROM ${table} WHERE ${whereClause}`
        : `SELECT COUNT(*) as count FROM ${table}`
      const rows = await sql.query(query) as any[]
      return parseInt(rows[0]?.count || '0', 10)
    } catch {
      return 0
    }
  }

  const user_count = await safeCount('tenant_users', `tenant_id = '${tenantId}'`)
  const client_count = await safeCount('clients', `tenant_id = '${tenantId}'`)
  const visit_count = await safeCount('visits', `tenant_id = '${tenantId}'`)
  const today = new Date().toISOString().split('T')[0]
  const active_today = await safeCount('visits', `tenant_id = '${tenantId}' AND DATE(clock_in_at) = '${today}'`)

  return { user_count, client_count, visit_count, active_today }
}

export async function getAllTenantsWithStats(): Promise<Array<{
  id: string
  slug: string
  name: string
  plan: string
  active: boolean
  max_users: number
  max_clients: number
  subscription_status: string
  user_count: number
  client_count: number
  visit_count: number
  created_at: string
}>> {
  const sql = getSql()

  // Fetch tenants first; if subqueries fail due to missing tenant_id columns,
  // fall back to basic tenant list and query counts separately.
  let tenantRows: any[]
  try {
    tenantRows = await sql`
      SELECT t.*,
        (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = t.id) as user_count,
        (SELECT COUNT(*) FROM clients WHERE tenant_id = t.id) as client_count,
        (SELECT COUNT(*) FROM visits WHERE tenant_id = t.id) as visit_count
      FROM tenants t
      ORDER BY t.created_at DESC
    ` as any[]
  } catch {
    // tenant_id columns may be missing; fetch basic tenant list
    tenantRows = await sql`SELECT * FROM tenants ORDER BY created_at DESC` as any[]
  }

  // If subqueries didn't run, fetch counts separately with safe raw SQL
  const needsCounts = tenantRows.length > 0 && tenantRows[0].user_count === undefined
  if (needsCounts) {
    const safeCount = async (table: string, tenantId: string): Promise<number> => {
      try {
        const rows = await sql.query(`SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = '${tenantId}'`) as any[]
        return parseInt(rows[0]?.count || '0', 10)
      } catch {
        return 0
      }
    }
    for (const t of tenantRows) {
      t.user_count = await safeCount('tenant_users', t.id)
      t.client_count = await safeCount('clients', t.id)
      t.visit_count = await safeCount('visits', t.id)
    }
  }

  return tenantRows.map(r => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    plan: r.plan,
    active: r.active ?? true,
    max_users: r.max_users ?? 3,
    max_clients: r.max_clients ?? 10,
    subscription_status: r.subscription_status ?? 'active',
    user_count: parseInt(r.user_count || '0', 10),
    client_count: parseInt(r.client_count || '0', 10),
    visit_count: parseInt(r.visit_count || '0', 10),
    created_at: r.created_at,
  }))
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

  const user = await getUserFromToken(sql, token)
  if (!user) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  // Verify user has access to this tenant
  const access = await verifyTenantAccess(user.id, tenant.id)
  if (!access.hasAccess) {
    await logAuditEvent({
      userId: user.id,
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
  await handler({ tenantId: tenant.id, userId: user.id, role: access.role, sql })
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
