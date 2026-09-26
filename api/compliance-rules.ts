import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

/**
 * Declarative compliance rules engine — evaluates tenant data against
 * CQC-aligned evidence rules and returns green/amber/red/unknown status
 * per area plus actionable flags.
 *
 * Ported from the vision prototype's compliance-rules.ts, adapted to this
 * schema — this database HAS credential tables (dbs_checks, training,
 * right_to_work, supervisions) so those rules evaluate real data here.
 */

export type ComplianceFlag = {
  rule: string
  reason: string
  action: string
  targetKind: 'carer' | 'visit' | 'mar' | 'client' | 'agency'
  targetId: string
  clientId?: string
}
export type ComplianceStatus = 'green' | 'amber' | 'red' | 'unknown'
export type ComplianceArea = {
  key: string
  label: string
  status: ComplianceStatus
  flags: ComplianceFlag[]
}

const blank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')
const flag = (rule: string, reason: string, action: string, targetKind: ComplianceFlag['targetKind'], targetId: string, clientId?: string): ComplianceFlag =>
  ({ rule, reason, action, targetKind, targetId, ...(clientId ? { clientId } : {}) })
const statusOf = (flags: ComplianceFlag[], hasData: boolean): ComplianceStatus =>
  flags.some((f) => f.rule.startsWith('red:')) ? 'red'
    : flags.some((f) => f.rule.startsWith('amber:')) ? 'amber'
    : flags.some((f) => f.rule.startsWith('unknown:')) ? 'unknown'
    : hasData ? 'green' : 'unknown'

export function evaluateCompliance(input: {
  visits: any[]
  medications: any[]
  carers: any[]
  dbs: any[]
  training: any[]
  rtw: any[]
  supervisions: any[]
  carePlans: any[]
}) {
  const { visits, medications, carers, dbs, training, rtw, supervisions, carePlans } = input
  const now = new Date()

  // ─── Staff suitability (DBS / training / RTW / supervision) ───
  const credFlags: ComplianceFlag[] = []
  const dbsByCarer = new Map(dbs.map((d) => [d.carer_id, d]))
  const rtwByCarer = new Map(rtw.map((r) => [r.carer_id, r]))
  const trainByCarer = new Map<string, any[]>()
  for (const t of training) {
    if (!trainByCarer.has(t.carer_id)) trainByCarer.set(t.carer_id, [])
    trainByCarer.get(t.carer_id)!.push(t)
  }
  const supByCarer = new Map<string, any[]>()
  for (const s of supervisions) {
    if (!supByCarer.has(s.carer_id)) supByCarer.set(s.carer_id, [])
    supByCarer.get(s.carer_id)!.push(s)
  }

  for (const carer of carers) {
    const d = dbsByCarer.get(carer.id)
    if (!d) credFlags.push(flag('red:no-dbs', `${carer.name || carer.id} has no DBS check on record.`, 'Add a DBS check record.', 'carer', carer.id))
    else if (d.expiry_date && new Date(d.expiry_date) < now)
      credFlags.push(flag('red:dbs-expired', `${carer.name || carer.id}'s DBS expired ${d.expiry_date}.`, 'Renew the DBS check.', 'carer', carer.id))
    else if (d.expiry_date && new Date(d.expiry_date).getTime() - now.getTime() < 30 * 86400000)
      credFlags.push(flag('amber:dbs-expiring', `${carer.name || carer.id}'s DBS expires within 30 days.`, 'Schedule DBS renewal.', 'carer', carer.id))

    const r = rtwByCarer.get(carer.id)
    if (!r) credFlags.push(flag('red:no-rtw', `${carer.name || carer.id} has no right-to-work check on record.`, 'Complete a right-to-work check.', 'carer', carer.id))
    else if (r.verification_status !== 'verified')
      credFlags.push(flag('amber:rtw-unverified', `${carer.name || carer.id}'s right-to-work is '${r.verification_status}'.`, 'Verify right-to-work evidence.', 'carer', carer.id))
    else if (r.visa_expiry && new Date(r.visa_expiry) < now)
      credFlags.push(flag('red:visa-expired', `${carer.name || carer.id}'s visa expired ${r.visa_expiry}.`, 'Renew visa / re-verify right to work.', 'carer', carer.id))

    const certs = trainByCarer.get(carer.id) || []
    const expired = certs.filter((t) => t.expiry_date && new Date(t.expiry_date) < now)
    if (certs.length === 0) credFlags.push(flag('amber:no-training', `${carer.name || carer.id} has no training records.`, 'Add training certifications.', 'carer', carer.id))
    else if (expired.length > 0) credFlags.push(flag('amber:training-expired', `${carer.name || carer.id} has ${expired.length} expired certification(s).`, 'Renew expired training.', 'carer', carer.id))

    const sups = (supByCarer.get(carer.id) || []).filter((s) => s.status === 'completed')
    const lastSup = sups.sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())[0]
    if (!lastSup) credFlags.push(flag('amber:no-supervision', `${carer.name || carer.id} has no completed supervision.`, 'Schedule a supervision.', 'carer', carer.id))
    else if (now.getTime() - new Date(lastSup.scheduled_date).getTime() > 90 * 86400000)
      credFlags.push(flag('amber:supervision-overdue', `${carer.name || carer.id}'s last supervision was over 90 days ago.`, 'Schedule a supervision.', 'carer', carer.id))
  }

  // ─── Visit continuity ───
  const visitFlags: ComplianceFlag[] = []
  for (const v of visits) {
    const status = (v.status || '').trim().toLowerCase()
    if (['missed', 'incomplete', 'not completed'].includes(status))
      visitFlags.push(flag('red:visit-status', `Visit for ${v.client_name || v.client_id} is ${v.status}.`, 'Review and complete the visit record.', 'visit', v.id, v.client_id))
    else if (status !== 'completed')
      visitFlags.push(flag('amber:visit-status', `Visit for ${v.client_name || v.client_id} is not completed.`, 'Review and complete the visit record.', 'visit', v.id, v.client_id))
    if (v.geo_verified === false && status === 'completed')
      visitFlags.push(flag('amber:no-evv', `Completed visit for ${v.client_name || v.client_id} has no location/tag verification.`, 'Ensure EVV evidence is captured at clock-in.', 'visit', v.id, v.client_id))
  }

  // ─── Documentation quality ───
  const docFlags: ComplianceFlag[] = []
  for (const v of visits) {
    if (blank(v.notes) && blank(v.handover_note) && (v.status || '').toLowerCase() === 'completed')
      docFlags.push(flag('red:blank-notes', `Completed visit for ${v.client_name || v.client_id} has no notes.`, 'Complete the visit notes.', 'visit', v.id, v.client_id))
    for (const [field, label] of [['mood', 'mood'], ['meal_status', 'meal'], ['fluid_glasses', 'fluid']] as const) {
      const value = v[field]
      if ((v.status || '').toLowerCase() === 'completed' && (value == null || (typeof value === 'string' && value.trim() === '')))
        docFlags.push(flag(`amber:missing-${field}`, `Visit for ${v.client_name || v.client_id} is missing ${label} evidence.`, `Add ${label} evidence to the visit record.`, 'visit', v.id, v.client_id))
    }
  }
  for (const cp of carePlans) {
    if (cp.status === 'draft')
      docFlags.push(flag('amber:unpublished-careplan', `Care plan for ${cp.client_name || cp.client_id} is still a draft.`, 'Review and publish the care plan.', 'client', cp.client_id))
  }

  // ─── MAR (medication administration records) ───
  const marFlags: ComplianceFlag[] = []
  for (const m of medications) {
    if (blank(m.medication_name)) marFlags.push(flag('red:missing-medication-name', 'Medication record has no medication name.', 'Add the medication name.', 'mar', m.id, m.client_id))
    const st = (m.status || '').trim().toLowerCase()
    if (blank(m.status)) marFlags.push(flag('red:unsupported-status', 'Medication status is blank.', 'Correct the medication status.', 'mar', m.id, m.client_id))
    else if (!['given', 'refused', 'not_given', 'not given', 'omitted', 'deferred'].includes(st))
      marFlags.push(flag('red:unsupported-status', `Medication status '${m.status}' is unsupported.`, 'Correct the medication status.', 'mar', m.id, m.client_id))
    if (st === 'refused' && blank(m.reason))
      marFlags.push(flag('red:refused-without-reason', `Medication refused without a reason (${m.client_name || m.client_id}).`, 'Record the reason for refusal.', 'mar', m.id, m.client_id))
    if (blank(m.visit_id)) marFlags.push(flag('amber:missing-visit-link', `Medication record for ${m.client_name || m.client_id} is not linked to a visit.`, 'Link the medication record to a visit.', 'mar', m.id, m.client_id))
    if (blank(m.dose)) marFlags.push(flag('amber:missing-dose', `Medication record for ${m.medication_name || m.client_name || m.client_id} is missing dose.`, 'Add the medication dose.', 'mar', m.id, m.client_id))
  }

  const areas: ComplianceArea[] = [
    { key: 'credentials', label: 'Staff suitability and oversight', status: statusOf(credFlags, carers.length > 0), flags: credFlags },
    { key: 'visits', label: 'Safe continuity of care', status: statusOf(visitFlags, visits.length > 0), flags: visitFlags },
    { key: 'documentation', label: 'Care records and management oversight', status: statusOf(docFlags, visits.length > 0 || carePlans.length > 0), flags: docFlags },
    { key: 'mar', label: 'Safe medication administration and recording', status: statusOf(marFlags, medications.length > 0), flags: marFlags },
  ]
  const allFlags = [...credFlags, ...visitFlags, ...docFlags, ...marFlags]
  const overallStatus = statusOf(allFlags, true)

  return {
    areas,
    flags: allFlags,
    counts: {
      visits: visits.length,
      medications: medications.length,
      carers: carers.length,
      carePlans: carePlans.length,
      flags: allFlags.length,
    },
    overallStatus,
    disclaimer: 'CQC evidence indicators only; this dashboard is not a regulatory judgement.',
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  try {
    await ensureTables()
    const tenantSlug = getTenantSlug(req)
    if (!tenantSlug) {
      res.status(400).json({ error: 'Tenant slug required (X-Tenant-Slug header)' })
      return
    }

    await withTenant(req, res, async ({ tenantId, role, sql }) => {
      if (role !== 'manager' && role !== 'admin' && role !== 'superadmin') {
        res.status(403).json({ error: 'Managers only' })
        return
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

      const [visits, medications, carers, dbs, training, rtw, supervisions, carePlans] = await Promise.all([
        sql`
          SELECT v.id, v.client_id, v.client_name, v.status, v.notes, v.mood, v.meal_status, v.fluid_glasses,
                 v.handover_note, v.geo_verified
          FROM visits v WHERE v.tenant_id = ${tenantId} AND v.submitted_at >= ${thirtyDaysAgo}
        ` as Promise<any[]>,
        sql`
          SELECT m.id, m.client_id, m.visit_id, m.medication_name, m.status, m.reason, m.dose, c.name AS client_name
          FROM medication_logs m LEFT JOIN clients c ON c.id = m.client_id
          WHERE m.tenant_id = ${tenantId} AND m.created_at >= ${thirtyDaysAgo}
        ` as Promise<any[]>,
        sql`
          SELECT u.id, u.name FROM tenant_users tu JOIN users u ON u.id = tu.user_id
          WHERE tu.tenant_id = ${tenantId} AND tu.role IN ('carer', 'manager')
        ` as Promise<any[]>,
        sql`SELECT carer_id, expiry_date, status FROM dbs_checks WHERE tenant_id = ${tenantId}` as Promise<any[]>,
        sql`SELECT carer_id, expiry_date, status FROM training_certifications WHERE tenant_id = ${tenantId}` as Promise<any[]>,
        sql`SELECT carer_id, verification_status, visa_expiry FROM right_to_work_checks WHERE tenant_id = ${tenantId}` as Promise<any[]>,
        sql`SELECT carer_id, scheduled_date, status FROM supervisions WHERE tenant_id = ${tenantId}` as Promise<any[]>,
        sql`
          SELECT cp.client_id, cp.status, c.name AS client_name
          FROM care_plans cp LEFT JOIN clients c ON c.id = cp.client_id
          WHERE cp.tenant_id = ${tenantId}
        ` as Promise<any[]>,
      ])

      res.status(200).json(evaluateCompliance({ visits, medications, carers, dbs, training, rtw, supervisions, carePlans }))
    })
  } catch (err: any) {
    console.error('[compliance-rules] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
