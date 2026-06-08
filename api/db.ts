import { neon } from '@neondatabase/serverless'

export function getSql() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL not set')
  return neon(connectionString)
}

let initPromise: Promise<void> | null = null

export async function ensureTables() {
  if (initPromise) return initPromise
  initPromise = runInit()
  return initPromise
}

async function runInit() {
  const sql = getSql()

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
    CREATE TABLE IF NOT EXISTS carers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      location TEXT,
      client TEXT,
      since TEXT,
      avatar TEXT
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
      emergency_contact TEXT
    )
  `

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

  await sql`
    CREATE TABLE IF NOT EXISTS medication_logs (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      client_name TEXT,
      carer_id TEXT,
      carer_name TEXT,
      medication_name TEXT NOT NULL,
      dose TEXT,
      scheduled_time TEXT,
      status TEXT DEFAULT 'pending',
      reason TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS caregiver_client_assignments (
      id TEXT PRIMARY KEY,
      caregiver_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(caregiver_id, client_id)
    )
  `

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

  // No mock seed data — only real data is shown
}

export function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}
