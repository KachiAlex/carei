import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, withTenant, getTenantSlug, checkRateLimit } from './db.js'
import { parseBody, z } from './validate.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

const DOCUMENT_TEMPLATES: Record<string, { name: string; systemPrompt: string }> = {
  incident_report: {
    name: 'Incident Report',
    systemPrompt: `You are a care documentation assistant generating an incident report for a UK care agency.
Use UK English and CQC-aligned terminology.
Return ONLY valid JSON with this structure:
{
  "title": "Brief incident title",
  "date": "Date/time of incident",
  "location": "Where it occurred",
  "peopleInvolved": ["Names and roles"],
  "description": "Factual description of what happened",
  "immediateActions": ["Actions taken at the time"],
  "outcome": "Result/impact on service user",
  "followUp": ["Recommended follow-up actions"],
  "riskAssessment": "Updated risk level and rationale",
  "cqcNotifiable": true/false
}`,
  },
  care_assessment_summary: {
    name: 'Care Assessment Summary',
    systemPrompt: `You are a care documentation assistant generating a care assessment summary for a UK care agency.
Return ONLY valid JSON with this structure:
{
  "title": "Assessment summary title",
  "clientName": "Name",
  "assessmentDate": "Date",
  "summary": "Overall assessment summary",
  "mobilityStatus": "Current mobility assessment",
  "mentalWellbeing": "Mental health and wellbeing observations",
  "medicalObservations": ["Key medical observations"],
  "careNeedsIdentified": ["Identified care needs"],
  "recommendations": ["Care recommendations"],
  "reviewDate": "Recommended next review date"
}`,
  },
  general_letter: {
    name: 'General Letter',
    systemPrompt: `You are a care documentation assistant generating a general letter for a UK care agency (e.g. to family, GP, or commissioner).
Use UK English, professional tone.
Return ONLY valid JSON with this structure:
{
  "title": "Letter subject",
  "recipient": "Recipient name/role",
  "body": "Full letter body text",
  "signOff": "Closing line"
}`,
  },
}

function generateId(): string {
  return 'doc-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
}

const generateSchema = z.object({
  templateType: z.enum(['incident_report', 'care_assessment_summary', 'general_letter']),
  input: z.string().min(1).max(20000),
  clientId: z.string().optional(),
  visitId: z.string().optional(),
})

const saveSchema = z.object({
  templateType: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  content: z.record(z.string(), z.unknown()),
  clientId: z.string().optional(),
  visitId: z.string().optional(),
  documentId: z.string().optional(),
  confirm: z.boolean().optional(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    await ensureTables()
    const sql = getSql()
    const tenantSlug = getTenantSlug(req)
    const subPath = (req.url || '').split('?')[0].replace(/^\/api\/documents\/?/, '').replace(/^\//, '')

    // ─── POST /api/documents/generate — AI draft (not persisted) ───
    if (req.method === 'POST' && subPath === 'generate') {
      const limit = checkRateLimit(req, 'doc-generate', 10, 60000)
      if (!limit.allowed) {
        res.status(429).json({ error: 'Too many requests', retryAfter: limit.retryAfter })
        return
      }
      const parsed = parseBody(generateSchema, req.body)
      if (!parsed.data) { res.status(400).json({ error: parsed.error }); return }
      if (!ANTHROPIC_API_KEY) { res.status(503).json({ error: 'AI service not configured' }); return }

      const token = getAuthToken(req)
      const user = await getUserFromToken(sql, token)
      if (!user) { res.status(401).json({ error: 'Invalid token' }); return }

      const template = DOCUMENT_TEMPLATES[parsed.data.templateType]
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
          system: template.systemPrompt,
          messages: [{ role: 'user', content: parsed.data.input }],
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        res.status(502).json({ error: 'Anthropic API error', detail: err })
        return
      }

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      let content: any
      try { content = JSON.parse(text) } catch { content = { raw: text } }

      res.status(200).json({
        templateType: parsed.data.templateType,
        templateName: template.name,
        title: content.title || template.name,
        content,
        tokens: data.usage?.output_tokens,
      })
      return
    }

    // ─── POST /api/documents — save (draft) or confirm ───
    if (req.method === 'POST' && !subPath) {
      const parsed = parseBody(saveSchema, req.body)
      if (!parsed.data) { res.status(400).json({ error: parsed.error }); return }
      const d = parsed.data

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, userId, sql: ts }) => {
          if (d.clientId) {
            const cl = await ts`SELECT id FROM clients WHERE id = ${d.clientId} AND tenant_id = ${tenantId}` as any[]
            if (!cl[0]) { res.status(403).json({ error: 'Client not found in this organization' }); return }
          }
          if (d.documentId) {
            await ts`
              UPDATE documents SET title = ${d.title}, content = ${JSON.stringify(d.content)},
                status = ${d.confirm ? 'confirmed' : 'draft'},
                confirmed_by = ${d.confirm ? userId : null},
                confirmed_at = ${d.confirm ? new Date().toISOString() : null},
                updated_at = NOW()
              WHERE id = ${d.documentId} AND tenant_id = ${tenantId}
            `
            res.status(200).json({ id: d.documentId, status: d.confirm ? 'confirmed' : 'draft' })
            return
          }
          const id = generateId()
          await ts`
            INSERT INTO documents (id, tenant_id, client_id, visit_id, template_type, title, content, status, generated_by, confirmed_by, confirmed_at)
            VALUES (${id}, ${tenantId}, ${d.clientId || null}, ${d.visitId || null}, ${d.templateType}, ${d.title},
              ${JSON.stringify(d.content)}, ${d.confirm ? 'confirmed' : 'draft'}, ${userId},
              ${d.confirm ? userId : null}, ${d.confirm ? new Date().toISOString() : null})
          `
          res.status(201).json({ id, status: d.confirm ? 'confirmed' : 'draft' })
        })
        return
      }

      const token = getAuthToken(req)
      const user = await getUserFromToken(sql, token)
      if (!user) { res.status(401).json({ error: 'Invalid token' }); return }
      const id = generateId()
      await sql`
        INSERT INTO documents (id, client_id, visit_id, template_type, title, content, status, generated_by, confirmed_by, confirmed_at)
        VALUES (${id}, ${d.clientId || null}, ${d.visitId || null}, ${d.templateType}, ${d.title},
          ${JSON.stringify(d.content)}, ${d.confirm ? 'confirmed' : 'draft'}, ${user.id},
          ${d.confirm ? user.id : null}, ${d.confirm ? new Date().toISOString() : null})
      `
      res.status(201).json({ id, status: d.confirm ? 'confirmed' : 'draft' })
      return
    }

    // ─── GET /api/documents — list (optional ?id= / ?clientId= / ?status=) ───
    if (req.method === 'GET') {
      const { id, clientId, status } = req.query as { id?: string; clientId?: string; status?: string }

      if (tenantSlug) {
        await withTenant(req, res, async ({ tenantId, sql: ts }) => {
          if (id) {
            const rows = await ts`
              SELECT d.*, c.name AS client_name FROM documents d
              LEFT JOIN clients c ON c.id = d.client_id
              WHERE d.id = ${id} AND d.tenant_id = ${tenantId} LIMIT 1
            ` as any[]
            if (!rows[0]) { res.status(404).json({ error: 'Document not found' }); return }
            res.status(200).json({ document: rows[0] })
            return
          }
          let rows: any[]
          if (clientId) {
            rows = await ts`
              SELECT d.id, d.template_type, d.title, d.status, d.client_id, d.visit_id, d.confirmed_at, d.created_at, d.updated_at, c.name AS client_name
              FROM documents d LEFT JOIN clients c ON c.id = d.client_id
              WHERE d.tenant_id = ${tenantId} AND d.client_id = ${clientId}
              ORDER BY d.created_at DESC LIMIT 100
            ` as any[]
          } else if (status) {
            rows = await ts`
              SELECT d.id, d.template_type, d.title, d.status, d.client_id, d.visit_id, d.confirmed_at, d.created_at, d.updated_at, c.name AS client_name
              FROM documents d LEFT JOIN clients c ON c.id = d.client_id
              WHERE d.tenant_id = ${tenantId} AND d.status = ${status}
              ORDER BY d.created_at DESC LIMIT 100
            ` as any[]
          } else {
            rows = await ts`
              SELECT d.id, d.template_type, d.title, d.status, d.client_id, d.visit_id, d.confirmed_at, d.created_at, d.updated_at, c.name AS client_name
              FROM documents d LEFT JOIN clients c ON c.id = d.client_id
              WHERE d.tenant_id = ${tenantId}
              ORDER BY d.created_at DESC LIMIT 100
            ` as any[]
          }
          res.status(200).json({ documents: rows })
        })
        return
      }

      const token = getAuthToken(req)
      const user = await getUserFromToken(sql, token)
      if (!user) { res.status(401).json({ error: 'Invalid token' }); return }
      const rows = await sql`
        SELECT id, template_type, title, status, client_id, visit_id, confirmed_at, created_at, updated_at
        FROM documents WHERE generated_by = ${user.id} ORDER BY created_at DESC LIMIT 100
      ` as any[]
      res.status(200).json({ documents: rows })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[documents] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
