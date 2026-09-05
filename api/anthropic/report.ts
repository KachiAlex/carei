import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, getTenantSlug } from '../db.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

const REPORT_TEMPLATES: Record<string, { name: string; systemPrompt: string; fields: string[] }> = {
  'incident-report': {
    name: 'Incident Report',
    systemPrompt: `You are a care documentation assistant generating an incident report for a UK care agency.
Generate a structured incident report from the provided information.
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
  "reportingOfficer": "Name (to be filled by user)",
  "cqcNotifiable": true/false
}`,
    fields: ['title', 'date', 'location', 'peopleInvolved', 'description', 'immediateActions', 'outcome', 'followUp', 'riskAssessment', 'cqcNotifiable'],
  },
  'assessment-summary': {
    name: 'Assessment Summary',
    systemPrompt: `You are a care documentation assistant generating a care assessment summary for a UK care agency.
Generate a structured assessment summary from the provided visit data and notes.
Return ONLY valid JSON with this structure:
{
  "clientName": "Name",
  "assessmentDate": "Date",
  "summary": "Overall assessment summary",
  "mobilityStatus": "Current mobility assessment",
  "mentalWellbeing": "Mental health and wellbeing observations",
  "medicalObservations": ["Key medical observations"],
  "careNeedsIdentified": ["Identified care needs"],
  "recommendations": ["Care recommendations"],
  "reviewDate": "Recommended next review date",
  "assessor": "Name (to be filled by user)"
}`,
    fields: ['clientName', 'assessmentDate', 'summary', 'mobilityStatus', 'mentalWellbeing', 'medicalObservations', 'careNeedsIdentified', 'recommendations', 'reviewDate'],
  },
  'care-review': {
    name: 'Care Plan Review',
    systemPrompt: `You are a care documentation assistant generating a care plan review document for a UK care agency.
Generate a structured review from the provided care plan and recent visit data.
Return ONLY valid JSON with this structure:
{
  "clientName": "Name",
  "reviewDate": "Date",
  "planVersion": "Current version",
  "objectivesProgress": [{"objective": "...", "status": "achieved|progressing|not-met", "notes": "..."}],
  "changesNeeded": ["Suggested changes to care plan"],
  "newRisks": ["Newly identified risks"],
  "resolvedRisks": ["Risks that have been resolved"],
  "reviewerRecommendation": "continue|revise|escalate",
  "nextReviewDate": "Recommended next review date"
}`,
    fields: ['clientName', 'reviewDate', 'planVersion', 'objectivesProgress', 'changesNeeded', 'newRisks', 'resolvedRisks', 'reviewerRecommendation', 'nextReviewDate'],
  },
  'visit-summary-report': {
    name: 'Visit Summary Report',
    systemPrompt: `You are a care documentation assistant generating a visit summary report from visit records.
Summarise the visit data provided into a structured report. Never invent figures — only describe the data given.
Return ONLY valid JSON with this structure:
{
  "reportPeriod": "Date range",
  "totalVisits": 0,
  "completedVisits": 0,
  "missedVisits": 0,
  "averageDuration": "e.g. 45 minutes",
  "clientSummary": "Narrative summary of visits",
  "keyObservations": ["Key observations across visits"],
  "concerns": ["Any concerns identified"],
  "positiveNotes": ["Positive outcomes observed"],
  "recommendations": ["Recommendations for care team"]
}`,
    fields: ['reportPeriod', 'totalVisits', 'completedVisits', 'missedVisits', 'averageDuration', 'clientSummary', 'keyObservations', 'concerns', 'positiveNotes', 'recommendations'],
  },
  'safeguarding-referral': {
    name: 'Safeguarding Referral',
    systemPrompt: `You are a care documentation assistant generating a safeguarding referral document for a UK care agency.
Generate a structured safeguarding referral from the provided information.
This is a serious document — be factual, specific, and avoid speculation.
Return ONLY valid JSON with this structure:
{
  "referralDate": "Date",
  "clientName": "Name",
  "clientDOB": "Date of birth",
  "allegedSourceOfRisk": "Person or situation",
  "natureOfConcern": "Factual description of the concern",
  "howIdentified": "How the concern was identified",
  "immediateActionsTaken": ["Actions taken"],
  "agenciesNotified": ["Agencies notified (e.g. local authority safeguarding team)"],
  "riskToClient": "low|medium|high",
  "supportNeeded": ["Support the client needs"],
  "reportingOfficer": "Name (to be filled by user)"
}`,
    fields: ['referralDate', 'clientName', 'clientDOB', 'allegedSourceOfRisk', 'natureOfConcern', 'howIdentified', 'immediateActionsTaken', 'agenciesNotified', 'riskToClient', 'supportNeeded', 'reportingOfficer'],
  },
  'compliance-audit': {
    name: 'Compliance Audit Report',
    systemPrompt: `You are a care documentation assistant generating a compliance audit report for a UK care agency.
Generate a structured compliance audit from the provided data, aligned with CQC quality statements.
Return ONLY valid JSON with this structure:
{
  "auditDate": "Date",
  "auditor": "Name (to be filled by user)",
  "areasAudited": ["Areas checked"],
  "findings": [{"area": "...", "status": "compliant|minor|non-compliant", "detail": "..."}],
  "overallRating": "good|requires-improvement|inadequate",
  "actionItems": [{"action": "...", "priority": "high|medium|low", "dueDate": "..."}],
  "positivePractice": ["Examples of good practice"],
  "recommendations": ["Recommendations for improvement"]
}`,
    fields: ['auditDate', 'auditor', 'areasAudited', 'findings', 'overallRating', 'actionItems', 'positivePractice', 'recommendations'],
  },
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

    if (!ANTHROPIC_API_KEY) {
      res.status(503).json({ error: 'AI service not configured' })
      return
    }

    const { template, input, clientId, dateFrom, dateTo } = req.body || {}

    if (!template || !REPORT_TEMPLATES[template]) {
      res.status(400).json({
        error: 'Invalid template',
        available: Object.keys(REPORT_TEMPLATES),
      })
      return
    }

    const tpl = REPORT_TEMPLATES[template]
    let contextData = input || ''

    // If clientId and date range provided, load visit data from DB
    if (clientId && (dateFrom || dateTo)) {
      const slug = getTenantSlug(req)
      let visitRows: any[] = []

      if (slug) {
        const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1` as any[]
        if (tenantRows[0]) {
          visitRows = await sql`
            SELECT * FROM visits
            WHERE client_id = ${clientId}
              AND tenant_id = ${tenantRows[0].id}
              ${dateFrom ? sql`AND clock_in_at >= ${dateFrom}` : sql``}
              ${dateTo ? sql`AND clock_in_at <= ${dateTo}` : sql``}
            ORDER BY clock_in_at DESC
          ` as any[]
        }
      } else {
        visitRows = await sql`
          SELECT * FROM visits
          WHERE client_id = ${clientId}
            ${dateFrom ? sql`AND clock_in_at >= ${dateFrom}` : sql``}
            ${dateTo ? sql`AND clock_in_at <= ${dateTo}` : sql``}
          ORDER BY clock_in_at DESC
        ` as any[]
      }

      contextData += '\n\nVisit records:\n' + JSON.stringify(visitRows.slice(0, 50), null, 2)
    }

    if (!contextData.trim()) {
      res.status(400).json({ error: 'Input data or clientId with date range is required' })
      return
    }

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
        system: tpl.systemPrompt,
        messages: [{ role: 'user', content: `Generate a ${tpl.name} from this data:\n\n${contextData}` }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      res.status(502).json({ error: 'Anthropic API error', detail: err })
      return
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    let report: any
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      report = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    } catch {
      res.status(500).json({ error: 'Failed to parse AI response', raw: text })
      return
    }

    res.status(200).json({
      template,
      templateName: tpl.name,
      report,
      tokens: data.usage?.output_tokens,
    })
  } catch (err: any) {
    console.error('[anthropic/report] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}

// GET endpoint to list available templates
export async function getTemplates() {
  return Object.entries(REPORT_TEMPLATES).map(([key, tpl]) => ({
    id: key,
    name: tpl.name,
    fields: tpl.fields,
  }))
}
