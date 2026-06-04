import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')
const sql = neon(connectionString)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
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
        time TEXT,
        duration TEXT,
        status TEXT DEFAULT 'pending',
        tasks JSONB,
        flags JSONB,
        visit_date DATE DEFAULT CURRENT_DATE
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

    res.status(200).json({ status: 'initialized' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
