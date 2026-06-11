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
      emergency_contact TEXT,
      allergies TEXT,
      dysphagia_protocol TEXT,
      support_framework TEXT,
      communication_guidance TEXT,
      mobility TEXT,
      care_cues JSONB
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

  await sql`
    CREATE TABLE IF NOT EXISTS drug_interactions (
      id TEXT PRIMARY KEY,
      drug_a TEXT NOT NULL,
      drug_b TEXT NOT NULL,
      severity TEXT DEFAULT 'moderate',
      description TEXT
    )
  `

  // Seed common drug interactions (idempotent)
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

  // No mock seed data — only real data is shown

  // Cleanup previously seeded mock clients
  try {
    await sql`DELETE FROM clients WHERE name IN ('Aisha Khan', 'Grace Mensah', 'Mary Johnson', 'Tom Adams')`
  } catch { /* ignore */ }
}

export function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '*'
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', origin)
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
