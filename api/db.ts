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

  // Migrate databases that had the old medication_logs schema
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
