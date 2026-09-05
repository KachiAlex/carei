import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from '../db.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 2048

interface StructuredNote {
  handoverNote: string
  observations: string[]
  mood: string
  appetite: string
  mobility: string
  fluidIntake: string
  concerns: string[]
  tasksCompleted: string[]
  medicationsAdministered: string[]
  wellbeingNote: string
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

    const { transcript, visitId, tenantSlug } = req.body || {}

    if (!transcript || typeof transcript !== 'string') {
      res.status(400).json({ error: 'transcript is required' })
      return
    }

    if (transcript.length > 10000) {
      res.status(400).json({ error: 'Transcript exceeds 10000 character limit' })
      return
    }

    if (!ANTHROPIC_API_KEY) {
      res.status(503).json({ error: 'AI service not configured' })
      return
    }

    // If visitId provided, load visit context for smarter structuring
    let visitContext = ''
    if (visitId) {
      const slug = tenantSlug || getTenantSlug(req)
      let visitRows: any[] = []
      if (slug) {
        const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1` as any[]
        if (tenantRows[0]) {
          visitRows = await sql`
            SELECT v.*, c.name as client_name, c.conditions, c.medications, c.allergies
            FROM visits v
            LEFT JOIN clients c ON c.id = v.client_id
            WHERE v.id = ${visitId} AND v.tenant_id = ${tenantRows[0].id}
            LIMIT 1
          ` as any[]
        }
      } else {
        visitRows = await sql`
          SELECT v.*, c.name as client_name, c.conditions, c.medications, c.allergies
          FROM visits v
          LEFT JOIN clients c ON c.id = v.client_id
          WHERE v.id = ${visitId}
          LIMIT 1
        ` as any[]
      }

      if (visitRows[0]) {
        const v = visitRows[0]
        let conditions: any[] = []
        let medications: any[] = []
        try { conditions = typeof v.conditions === 'string' ? JSON.parse(v.conditions) : (v.conditions || []) } catch {}
        try { medications = typeof v.medications === 'string' ? JSON.parse(v.medications) : (v.medications || []) } catch {}
        visitContext = `\nVisit context:\n- Client: ${v.client_name || 'Unknown'}\n- Conditions: ${Array.isArray(conditions) ? conditions.join(', ') : conditions}\n- Known medications: ${Array.isArray(medications) ? medications.map((m: any) => m.name || '').join(', ') : ''}\n- Allergies: ${v.allergies || 'none recorded'}`
      }
    }

    const systemPrompt = `You are CAREi Voice-to-Documentation, a feature that structures voice transcripts from carers into structured visit notes for a UK care service.

Your output must be:
- Structured JSON matching the visit record fields exactly
- Factual — only include information the carer actually said
- Concise — each field should be brief and actionable
- UK English and care terminology

If the carer mentions something concerning (fall, medication error, distress), flag it in the concerns array.
If the carer mentions tasks they completed, list them in tasksCompleted.
If the carer mentions medications given, list them in medicationsAdministered.
If the carer describes mood, appetite, mobility, or fluid intake, extract those into the appropriate fields.
If a field is not mentioned in the transcript, leave it empty (empty string or empty array).

Return ONLY valid JSON with this structure:
{
  "handoverNote": "Summary for next carer",
  "observations": ["Key observations"],
  "mood": "happy|content|neutral|low|distressed|not-mentioned",
  "appetite": "good|fair|poor|none|not-mentioned",
  "mobility": "independent|with-aid|assistance-required|hoist|bedbound|not-mentioned",
  "fluidIntake": "good|adequate|low|none|not-mentioned",
  "concerns": ["Any concerns flagged"],
  "tasksCompleted": ["Tasks completed during visit"],
  "medicationsAdministered": ["Medications given"],
  "wellbeingNote": "Overall wellbeing observation"
}`

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
        temperature: 0.2,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Structure this voice transcript into visit notes:${visitContext}\n\nTranscript: "${transcript}"`,
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      res.status(502).json({ error: 'Anthropic API error', detail: err })
      return
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    let structured: StructuredNote
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      structured = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    } catch {
      res.status(500).json({ error: 'Failed to parse AI response', raw: text })
      return
    }

    // Ensure all fields exist
    structured.handoverNote = structured.handoverNote || ''
    structured.observations = Array.isArray(structured.observations) ? structured.observations : []
    structured.mood = structured.mood || ''
    structured.appetite = structured.appetite || ''
    structured.mobility = structured.mobility || ''
    structured.fluidIntake = structured.fluidIntake || ''
    structured.concerns = Array.isArray(structured.concerns) ? structured.concerns : []
    structured.tasksCompleted = Array.isArray(structured.tasksCompleted) ? structured.tasksCompleted : []
    structured.medicationsAdministered = Array.isArray(structured.medicationsAdministered) ? structured.medicationsAdministered : []
    structured.wellbeingNote = structured.wellbeingNote || ''

    res.status(200).json({
      structured,
      tokens: data.usage?.output_tokens,
    })
  } catch (err: any) {
    console.error('[anthropic/structure-notes] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
