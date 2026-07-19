import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken } from '../db.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 2048

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

interface CareContext {
  user: { id: string; name: string; email: string; role: string }
  today: string
  clients: any[]
  assignments: any[]
  tasks: any[]
  carePlans: any[]
  scheduledVisits: any[]
}

async function loadContext(sql: any, user: { id: string; name: string; email: string; role: string }): Promise<CareContext> {
  const currentDate = today()

  const assignments = await sql`
    SELECT a.client_id, a.visit_date, a.visit_time, a.instructions, c.name as client_name
    FROM caregiver_client_assignments a
    JOIN clients c ON c.id = a.client_id
    WHERE a.caregiver_id = ${user.id}
  ` as any[]

  const clientIds = [...new Set(assignments.map((a) => a.client_id).filter(Boolean))]

  let clients: any[] = []
  if (clientIds.length > 0) {
    clients = await sql`
      SELECT *
      FROM clients
      WHERE id IN (${clientIds})
    ` as any[]
  }

  const tasks = clientIds.length
    ? (await sql`
        SELECT t.*, c.name as client_name
        FROM tasks t
        JOIN clients c ON c.id = t.client_id
        WHERE t.client_id IN (${clientIds})
        ORDER BY c.name, t.name
      ` as any[])
    : []

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

  const scheduledVisits = await sql`
    SELECT *
    FROM scheduled_visits
    WHERE carer_id = ${user.id}
      AND visit_date = ${currentDate}
    ORDER BY time
  ` as any[]

  return {
    user,
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
}

function buildSystemPrompt(context: CareContext): string {
  const sections: string[] = []

  sections.push(
    `You are CAREi Copilot, a proactive and safety-first AI care assistant used by frontline carers in the UK.
` +
    `Today's date is ${context.today}. The current user is ${context.user.name} (${context.user.role}).
` +
    `Answer clearly, concisely, and only using the context provided. If you do not have enough information, say so and suggest what the user should check in the app.
` +
    `When discussing medication, allergies, or clinical tasks, always surface relevant safety flags and baseline information from the context first.`
  )

  if (context.clients.length === 0) {
    sections.push(`\nNo assigned clients were found for this carer. Suggest that the user checks their assignments or contact their manager.`)
  } else {
    sections.push(`\nAssigned clients:`)
    for (const c of context.clients) {
      const flags: string[] = []
      if (c.allergies) flags.push(`Allergies: ${c.allergies}`)
      if (c.mobility) flags.push(`Mobility: ${c.mobility}`)
      if (c.communication_guidance) flags.push(`Communication: ${c.communication_guidance}`)
      if (c.dysphagia_protocol) flags.push(`Dysphagia protocol: ${c.dysphagia_protocol}`)
      if (c.medications?.length) flags.push(`${c.medications.length} medication(s) on record`)

      sections.push(
        `- ${c.name} (age ${c.age || 'unknown'})${c.address ? `, ${c.address}` : ''}${flags.length ? ' — ' + flags.join(' | ') : ''}`
      )
    }
  }

  if (context.assignments.length > 0) {
    sections.push(`\nAssignments:`)
    for (const a of context.assignments) {
      const parts = [a.clientName]
      if (a.visitDate) parts.push(`date ${a.visitDate}`)
      if (a.visitTime) parts.push(`time ${a.visitTime}`)
      if (a.instructions) parts.push(`instructions: ${a.instructions}`)
      sections.push(`- ${parts.join(' — ')}`)
    }
  }

  if (context.tasks.length > 0) {
    sections.push(`\nTasks:`)
    for (const t of context.tasks) {
      sections.push(`- ${t.name} (${t.clientName})${t.description ? ': ' + t.description : ''}`)
    }
  } else {
    sections.push(`\nNo tasks are currently loaded for the assigned clients.`)
  }

  if (context.carePlans.length > 0) {
    sections.push(`\nActive/published care plans:`)
    for (const cp of context.carePlans) {
      const bullets = []
      if (cp.objectives?.length) bullets.push(`Objectives: ${cp.objectives.join('; ')}`)
      if (cp.risks?.length) bullets.push(`Risks: ${cp.risks.join('; ')}`)
      if (cp.preventive?.length) bullets.push(`Preventive: ${cp.preventive.join('; ')}`)
      sections.push(`- ${cp.clientName}: ${bullets.join(' | ')}`)
    }
  }

  if (context.scheduledVisits.length > 0) {
    sections.push(`\nToday's scheduled visits (${context.today}):`)
    for (const sv of context.scheduledVisits) {
      const parts = [sv.clientName]
      if (sv.time) parts.push(sv.time)
      if (sv.duration) parts.push(`(${sv.duration})`)
      if (sv.tasks?.length) parts.push(`tasks: ${sv.tasks.join(', ')}`)
      if (sv.flags?.length) parts.push(`flags: ${sv.flags.join(', ')}`)
      sections.push(`- ${parts.join(' — ')}`)
    }
  } else {
    sections.push(`\nNo visits are scheduled for today.`)
  }

  sections.push(
    `\nWhen the user asks a question, answer directly and ground your response in the data above.`
  )

  return sections.join('\n')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') {
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

    const { message, history = [] } = req.body || {}
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    if (!ANTHROPIC_API_KEY) {
      res.status(503).json({ error: 'AI service not configured' })
      return
    }

    const context = await loadContext(sql, user)
    const system = buildSystemPrompt(context)

    const messages = [
      ...(history || []).slice(-8),
      { role: 'user', content: message },
    ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      res.status(502).json({ error: 'Anthropic API error', detail: err })
      return
    }

    const data = await response.json()
    const reply = data.content?.[0]?.text || 'No response from AI.'

    res.status(200).json({
      reply,
      tokens: data.usage?.output_tokens,
      today: context.today,
      clientCount: context.clients.length,
      taskCount: context.tasks.length,
      visitCount: context.scheduledVisits.length,
    })
  } catch (err: any) {
    console.error('[copilot/chat] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
