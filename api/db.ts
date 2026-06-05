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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

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

  // Seed mock carers if empty
  const existing = await sql`SELECT COUNT(*) FROM carers` as any[]
  if (existing[0]?.count === '0') {
    await sql`
      INSERT INTO carers (id, name, status, location, client, since, avatar) VALUES
      ('c1', 'Sarah Johnson', 'in-visit', '12 Oak St', 'Margaret Wilson', '09:15', 'SJ'),
      ('c2', 'James Brown', 'in-visit', '45 Elm Ave', 'Robert Davies', '10:00', 'JB'),
      ('c3', 'Amina Patel', 'traveling', 'En route', 'Dorothy Lewis', '—', 'AP'),
      ('c4', 'David Chen', 'available', '—', '—', '—', 'DC')
    `
  }

  // Seed clients if empty
  const clientCount = await sql`SELECT COUNT(*) FROM clients` as any[]
  if (clientCount[0]?.count === '0') {
    await sql`
      INSERT INTO clients (id, name, age, address, conditions, medications, preferences, emergency_contact) VALUES
      ('c1', 'Mary Johnson', 82, '12 Oak Street, Manchester M1 1AA', '["Dementia (moderate)", "Type 2 diabetes", "Hypertension"]', '[{"name":"Metformin","dose":"500mg","frequency":"twice daily"},{"name":"Amlodipine","dose":"5mg","frequency":"once daily"},{"name":"Donepezil","dose":"10mg","frequency":"once daily"}]', 'Prefers morning visits before 10am. Sundowning from 4pm.', 'Sarah (daughter) — 07700 900001'),
      ('c2', 'Tom Adams', 74, '45 Pine Road, Leeds LS1 1BB', '["COPD", "Heart failure", "Depression"]', '[{"name":"Furosemide","dose":"40mg","frequency":"once daily"},{"name":"Bisoprolol","dose":"2.5mg","frequency":"once daily"},{"name":"Sertraline","dose":"50mg","frequency":"once daily"}]', 'Oxygen concentrator in situ. Must check O2 levels.', 'James (son) — 07700 900002'),
      ('c3', 'Aisha Khan', 67, '8 Maple Lane, Birmingham B1 1CC', '["Parkinson''s disease", "Osteoporosis"]', '[{"name":"Levodopa","dose":"100mg","frequency":"three times daily"},{"name":"Calcium + D3","dose":"-","frequency":"once daily"},{"name":"Rivastigmine","dose":"4.6mg patch","frequency":"daily"}]', 'Levodopa timing critical — within 30 min of scheduled time.', 'Ahmed (husband) — 07700 900003'),
      ('c4', 'Grace Mensah', 79, '3 Birch Close, Glasgow G1 1DD', '["Stroke (right-sided weakness)", "Dysphagia", "AF"]', '[{"name":"Apixaban","dose":"5mg","frequency":"twice daily"},{"name":"Lansoprazole","dose":"15mg","frequency":"once daily"}]', 'Thickened fluids only (Stage 2). Aspiration risk. Left-handed.', 'Kwame (son) — 07700 900004')
    `
  }

  // Seed scheduled visits if empty for today
  const visitCount = await sql`SELECT COUNT(*) FROM scheduled_visits WHERE visit_date = CURRENT_DATE` as any[]
  if (visitCount[0]?.count === '0') {
    await sql`
      INSERT INTO scheduled_visits (id, client_id, client_name, time, duration, status, tasks, flags, visit_date) VALUES
      ('v1', 'c1', 'Mary Johnson', '09:00', '1 hr', 'pending', '["Personal care", "Medication", "Breakfast"]', '["Dementia - use simple language", "Prefers female carers"]', CURRENT_DATE),
      ('v2', 'c2', 'Tom Adams', '10:30', '45 min', 'pending', '["Vitals", "Medication", "Wound check"]', '["O2 sat below target yesterday"]', CURRENT_DATE),
      ('v3', 'c3', 'Aisha Khan', '12:00', '45 min', 'pending', '["Medication", "Meal prep", "Mobility"]', '[]', CURRENT_DATE),
      ('v4', 'c4', 'Grace Mensah', '14:00', '1 hr', 'pending', '["Personal care", "Thickened fluids", "Medication"]', '["Thickened fluids only"]', CURRENT_DATE),
      ('v5', 'c1', 'Mary Johnson', '16:30', '30 min', 'pending', '["Evening check", "Medication"]', '["Sundowning risk after 4pm"]', CURRENT_DATE)
    `
  }
}

export function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}
