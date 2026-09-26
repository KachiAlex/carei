import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, withTenant, getTenantSlug } from '../db.js'
import { extractFamilySafeFacts, renderFamilySummary, sanitizeFamilyText } from '../family-safe.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

function safeJson<T>(value: unknown): T | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T } catch { return undefined }
  }
  return value as T
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

    const { visitId, tenantSlug } = req.body || {}
    if (!visitId) {
      res.status(400).json({ error: 'visitId is required' })
      return
    }

    const slug = tenantSlug || getTenantSlug(req)

    // Load visit data
    let visitRows: any[] = []
    if (slug) {
      const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1` as any[]
      if (tenantRows[0]) {
        visitRows = await sql`
          SELECT v.*, c.name as client_name, c.conditions, c.preferences
          FROM visits v
          LEFT JOIN clients c ON c.id = v.client_id
          WHERE v.id = ${visitId} AND v.tenant_id = ${tenantRows[0].id}
          LIMIT 1
        ` as any[]
      }
    } else {
      visitRows = await sql`
        SELECT v.*, c.name as client_name, c.conditions, c.preferences
        FROM visits v
        LEFT JOIN clients c ON c.id = v.client_id
        WHERE v.id = ${visitId}
        LIMIT 1
      ` as any[]
    }

    if (!visitRows[0]) {
      res.status(404).json({ error: 'Visit not found' })
      return
    }

    const visit = visitRows[0]

    // Check if family updates are consented
    let consentGranted = false
    try {
      const consentRows = await sql`
        SELECT value FROM client_settings
        WHERE client_id = ${visit.client_id}
          AND key = 'family_update_consent'
        LIMIT 1
      ` as any[]
      consentGranted = consentRows[0]?.value === 'true'
    } catch {
      // Table might not exist — default to not sending
    }

    if (!consentGranted) {
      res.status(200).json({
        generated: false,
        reason: 'Family update consent not granted for this client',
      })
      return
    }

    // Deterministic extraction — only whitelisted safe facts can reach family.
    // The AI only ever sees this fact set; raw visit fields (meds, notes,
    // incidents, carer details) never enter the prompt.
    const safeFacts = extractFamilySafeFacts({
      client_name: visit.client_name,
      clock_in_at: visit.clock_in_at,
      clock_out_at: visit.clock_out_at,
      mood: visit.mood,
      meal_status: visit.meal_status,
      fluid_glasses: visit.fluid_glasses,
      tasks: safeJson<string[]>(visit.tasks) || [],
    })

    // Deterministic fallback when the AI service is unavailable
    if (!ANTHROPIC_API_KEY) {
      res.status(200).json({
        generated: true,
        summary: renderFamilySummary(safeFacts),
        clientName: visit.client_name,
        visitDate: visit.clock_in_at,
        fallback: true,
      })
      return
    }

    const systemPrompt = `You are CAREi Family Update, a feature that generates brief, family-friendly updates after care visits for a UK care service.

Your output must be:
- Warm, reassuring, and non-technical (family members are not care professionals)
- Factual — only describe what happened during the visit, never speculate
- Privacy-respecting — do NOT include carer names, internal handover notes, incident details, or clinical jargon
- Short (3-5 sentences max)
- Focused on the service user's wellbeing and activities

If the visit data shows concerns (low mood, poor appetite, etc.), mention them gently and suggest the family contact the care office for more information.

Do NOT include:
- Carer names or personal details
- Internal handover notes
- Clinical terminology without plain-English explanation
- Medication names (refer to "medications were administered as prescribed")
- Any incident details (these are communicated separately by the office)`

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
        temperature: 0.4,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Generate a family update from these approved facts only — do not infer or add anything beyond them:\n\n${JSON.stringify(safeFacts, null, 2)}`,
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      res.status(502).json({ error: 'Anthropic API error', detail: err })
      return
    }

    const data = await response.json()
    const rawSummary = data.content?.[0]?.text || 'No summary generated.'

    // Post-generation safety net — redact anything that slipped through
    const { text: summary, removed } = sanitizeFamilyText(rawSummary)
    if (removed.length) {
      console.warn('[family-update] sanitized output removed:', removed.join(', '))
    }

    // Log that a family update was generated (audit trail)
    try {
      const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await sql`
        INSERT INTO audit_logs (id, action, resource, user_id, tenant_id, details, created_at)
        VALUES (${auditId}, 'family_update_generated', 'visit', ${user.id}, ${visit.tenant_id || null},
          ${JSON.stringify({ visitId, clientId: visit.client_id, consented: true })}, NOW())
      `
    } catch {}

    // Check for family members to notify (family_members table)
    let familyMembers: any[] = []
    try {
      familyMembers = await sql`
        SELECT id, name, email, phone FROM family_members
        WHERE client_id = ${visit.client_id}
          AND is_active = TRUE
          AND role IN ('primary', 'secondary')
      ` as any[]
    } catch {}

    res.status(200).json({
      generated: true,
      summary,
      clientName: visit.client_name,
      visitDate: visit.clock_in_at,
      familyMembersToNotify: familyMembers.map(f => ({ id: f.id, name: f.name, email: f.email })),
      tokens: data.usage?.output_tokens,
    })
  } catch (err: any) {
    console.error('[anthropic/family-update] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
