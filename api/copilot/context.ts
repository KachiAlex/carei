import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken } from '../db.js'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function safeJson<T>(value: unknown): T | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return undefined
    }
  }
  return value as T
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await ensureTables()
    const sql = getSql()
    const token = getAuthToken(req)
    const user = await getUserFromToken(sql, token)
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    const currentDate = today()

    // Assigned clients for this carer
    const assignments = await sql`
      SELECT a.client_id, a.visit_date, a.visit_time, a.instructions, c.name as client_name
      FROM caregiver_client_assignments a
      JOIN clients c ON c.id = a.client_id
      WHERE a.caregiver_id = ${user.id}
    ` as any[]

    const clientIds = [...new Set(assignments.map((a) => a.client_id).filter(Boolean))]

    // Client details
    let clients: any[] = []
    if (clientIds.length > 0) {
      clients = await sql`
        SELECT *
        FROM clients
        WHERE id IN (${clientIds})
      ` as any[]
    }

    // Tasks for assigned clients
    const tasks = clientIds.length
      ? (await sql`
          SELECT t.*, c.name as client_name
          FROM tasks t
          JOIN clients c ON c.id = t.client_id
          WHERE t.client_id IN (${clientIds})
          ORDER BY c.name, t.name
        ` as any[])
      : []

    // Care plans for assigned clients (only published or active ones)
    const carePlans = clientIds.length
      ? (await sql`
          SELECT cp.*, c.name as client_name
          FROM care_plans cp
          JOIN clients c ON c.id = cp.client_id
          WHERE cp.client_id IN (${clientIds})
            AND cp.status IN ('published', 'active')
          ORDER BY cp.updated_at DESC
        ` as any[])
      : []

    // Today's scheduled visits for this carer
    const scheduledVisits = await sql`
      SELECT *
      FROM scheduled_visits
      WHERE carer_id = ${user.id}
        AND visit_date = ${currentDate}
      ORDER BY time
    ` as any[]

    const clientMap = new Map(clients.map((c) => [c.id, c]))

    const payload = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      today: currentDate,
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        age: c.age,
        address: c.address,
        conditions: safeJson<string[]>(c.conditions) || [],
        medications: safeJson<{ name?: string; dose?: string; time?: string }[]>(c.medications) || [],
        allergies: c.allergies || '',
        preferences: c.preferences || '',
        emergency_contact: c.emergency_contact || '',
        dysphagia_protocol: c.dysphagia_protocol || '',
        support_framework: c.support_framework || '',
        communication_guidance: c.communication_guidance || '',
        mobility: c.mobility || '',
        care_cues: safeJson<string[]>(c.care_cues) || [],
        bp_baseline_systolic: c.bp_baseline_systolic,
        bp_baseline_diastolic: c.bp_baseline_diastolic,
      })),
      assignments: assignments.map((a) => ({
        clientId: a.client_id,
        clientName: a.client_name,
        visitDate: a.visit_date,
        visitTime: a.visit_time,
        instructions: a.instructions || '',
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        clientId: t.client_id,
        clientName: t.client_name,
        name: t.name,
        description: t.description || '',
        frequency: t.frequency || 'daily',
      })),
      carePlans: carePlans.map((cp) => ({
        id: cp.id,
        clientId: cp.client_id,
        clientName: cp.client_name,
        status: cp.status,
        objectives: cp.objectives || [],
        preventive: cp.preventive || [],
        risks: cp.risks || [],
        postMed: cp.post_med || [],
        lastReview: cp.last_review || [],
        pbsTriggers: cp.pbs_triggers || [],
        pbsCalmSigns: cp.pbs_calm_signs || [],
        pbsCalmActions: cp.pbs_calm_actions || [],
        pbsAnxiousSigns: cp.pbs_anxious_signs || [],
        pbsAnxiousActions: cp.pbs_anxious_actions || [],
        pbsRiskSigns: cp.pbs_risk_signs || [],
        pbsRiskActions: cp.pbs_risk_actions || [],
      })),
      scheduledVisits: scheduledVisits.map((sv) => ({
        id: sv.id,
        clientId: sv.client_id,
        clientName: sv.client_name,
        time: sv.time,
        duration: sv.duration,
        status: sv.status,
        tasks: safeJson<string[]>(sv.tasks) || [],
        flags: safeJson<string[]>(sv.flags) || [],
        recurring: sv.recurring,
      })),
    }

    res.status(200).json(payload)
  } catch (err: any) {
    console.error('[copilot/context] error:', err)
    res.status(500).json({ error: 'Failed to load copilot context', detail: err.message })
  }
}
