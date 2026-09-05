import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from '../db.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

interface ClientAssessment {
  name: string
  age?: number
  conditions?: string[]
  medications?: { name?: string; dose?: string; time?: string }[]
  allergies?: string
  preferences?: string
  mobility?: string
  communicationGuidance?: string
  supportFramework?: string
  dysphagiaProtocol?: string
  careCues?: string[]
  address?: string
  emergencyContact?: string
}

interface GeneratedCarePlan {
  objectives: string[]
  preventive: string[]
  risks: string[]
  postMed: string[]
  lastReview: string[]
  pbsTriggers: string[]
  safetyPlan: string[]
  pbsCalmSigns: string[]
  pbsCalmActions: string[]
  pbsAnxiousSigns: string[]
  pbsAnxiousActions: string[]
  pbsRiskSigns: string[]
  pbsRiskActions: string[]
  sources: { field: string; source: string }[]
}

function buildSystemPrompt(client: ClientAssessment): string {
  const sections: string[] = []
  sections.push(
    `You are CAREi AI, a care plan generation assistant for UK care agencies.
You generate CQC-aligned care plans from assessment data.
Your output must be structured JSON matching the care plan schema exactly.
Each field is an array of concise, actionable statements.
Every suggestion must reference which piece of assessment data it came from in the "sources" array.
Never invent information not present in the assessment. If information is missing, leave that field empty.
Be specific and practical — carers must be able to act on each statement.
Use UK English and UK care terminology (e.g. "service user", "carer", "local authority").`
  )

  sections.push(`\nAssessment data for ${client.name}:`)
  if (client.age) sections.push(`- Age: ${client.age}`)
  if (client.conditions?.length) sections.push(`- Conditions: ${client.conditions.join(', ')}`)
  if (client.medications?.length) sections.push(`- Medications: ${client.medications.map(m => `${m.name || ''} ${m.dose || ''} ${m.time || ''}`.trim()).join('; ')}`)
  if (client.allergies) sections.push(`- Allergies: ${client.allergies}`)
  if (client.preferences) sections.push(`- Preferences: ${client.preferences}`)
  if (client.mobility) sections.push(`- Mobility: ${client.mobility}`)
  if (client.communicationGuidance) sections.push(`- Communication: ${client.communicationGuidance}`)
  if (client.supportFramework) sections.push(`- Support framework: ${client.supportFramework}`)
  if (client.dysphagiaProtocol) sections.push(`- Dysphagia protocol: ${client.dysphagiaProtocol}`)
  if (client.careCues?.length) sections.push(`- Care cues: ${client.careCues.join(', ')}`)
  if (client.address) sections.push(`- Address: ${client.address}`)
  if (client.emergencyContact) sections.push(`- Emergency contact: ${client.emergencyContact}`)

  sections.push(`\nReturn ONLY valid JSON with this exact structure:
{
  "objectives": ["..."],
  "preventive": ["..."],
  "risks": ["..."],
  "postMed": ["..."],
  "lastReview": ["..."],
  "pbsTriggers": ["..."],
  "safetyPlan": ["..."],
  "pbsCalmSigns": ["..."],
  "pbsCalmActions": ["..."],
  "pbsAnxiousSigns": ["..."],
  "pbsAnxiousActions": ["..."],
  "pbsRiskSigns": ["..."],
  "pbsRiskActions": ["..."],
  "sources": [{ "field": "objectives", "source": "derived from conditions: diabetes" }]
}

Fields guide:
- objectives: Care goals for this client (e.g. "Maintain blood sugar within target range")
- preventive: Preventive measures (e.g. "Monitor fluid intake to prevent dehydration")
- risks: Identified risks (e.g. "Fall risk due to limited mobility")
- postMed: Post-medication observations (e.g. "Check blood pressure 30 mins after medication")
- lastReview: Review notes (e.g. "Review care plan monthly with GP")
- pbsTriggers: PBS triggers (behavioural)
- safetyPlan: Safety measures
- pbsCalmSigns/pbsCalmActions: Signs client is calm and what to do
- pbsAnxiousSigns/pbsAnxiousActions: Signs client is anxious and what to do
- pbsRiskSigns/pbsRiskActions: Signs of risk behaviour and what to do

Only populate PBS fields if behavioural information is available.`)

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

    if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'superadmin') {
      res.status(403).json({ error: 'Managers only' })
      return
    }

    if (!ANTHROPIC_API_KEY) {
      res.status(503).json({ error: 'AI service not configured' })
      return
    }

    const { clientId, assessmentText, tenantSlug } = req.body || {}

    if (!clientId && !assessmentText) {
      res.status(400).json({ error: 'clientId or assessmentText is required' })
      return
    }

    let clientData: ClientAssessment

    if (clientId) {
      // Load client from DB
      const slug = tenantSlug || getTenantSlug(req)
      let clientRows: any[] = []

      if (slug) {
        const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1` as any[]
        if (tenantRows[0]) {
          clientRows = await sql`SELECT * FROM clients WHERE id = ${clientId} AND tenant_id = ${tenantRows[0].id} LIMIT 1` as any[]
        }
      } else {
        clientRows = await sql`SELECT * FROM clients WHERE id = ${clientId} LIMIT 1` as any[]
      }

      if (!clientRows[0]) {
        res.status(404).json({ error: 'Client not found' })
        return
      }

      const c = clientRows[0]
      let conditions: string[] = []
      let medications: any[] = []
      let careCues: string[] = []
      try { conditions = typeof c.conditions === 'string' ? JSON.parse(c.conditions) : (c.conditions || []) } catch {}
      try { medications = typeof c.medications === 'string' ? JSON.parse(c.medications) : (c.medications || []) } catch {}
      try { careCues = typeof c.care_cues === 'string' ? JSON.parse(c.care_cues) : (c.care_cues || []) } catch {}

      clientData = {
        name: c.name,
        age: c.age,
        conditions,
        medications,
        allergies: c.allergies || '',
        preferences: c.preferences || '',
        mobility: c.mobility || '',
        communicationGuidance: c.communication_guidance || '',
        supportFramework: c.support_framework || '',
        dysphagiaProtocol: c.dysphagia_protocol || '',
        careCues,
        address: c.address || '',
        emergencyContact: c.emergency_contact || '',
      }

      // Merge in any additional assessment text
      if (assessmentText) {
        clientData.preferences = [clientData.preferences, assessmentText].filter(Boolean).join(' | ')
      }
    } else {
      // Use assessment text only
      clientData = {
        name: 'New Client',
        preferences: assessmentText,
      }
    }

    const systemPrompt = buildSystemPrompt(clientData)

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
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate a care plan from this assessment data. Return only valid JSON.' }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      res.status(502).json({ error: 'Anthropic API error', detail: err })
      return
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Parse JSON from response (handle markdown code blocks)
    let plan: GeneratedCarePlan
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      plan = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    } catch {
      res.status(500).json({ error: 'Failed to parse AI response', raw: text })
      return
    }

    // Ensure all fields are arrays
    const arrayFields = ['objectives', 'preventive', 'risks', 'postMed', 'lastReview',
      'pbsTriggers', 'safetyPlan', 'pbsCalmSigns', 'pbsCalmActions',
      'pbsAnxiousSigns', 'pbsAnxiousActions', 'pbsRiskSigns', 'pbsRiskActions']
    for (const f of arrayFields) {
      if (!Array.isArray(plan[f as keyof GeneratedCarePlan])) {
        (plan as any)[f] = []
      }
    }
    if (!Array.isArray(plan.sources)) plan.sources = []

    res.status(200).json({
      plan,
      tokens: data.usage?.output_tokens,
      clientName: clientData.name,
    })
  } catch (err: any) {
    console.error('[anthropic/care-plan] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
