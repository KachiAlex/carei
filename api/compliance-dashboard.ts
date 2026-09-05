import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, getTenantSlug } from './db.js'

interface ComplianceItem {
  category: string
  item: string
  status: 'compliant' | 'warning' | 'non-compliant'
  detail: string
  dueDate?: string
  cqcStatement: string
}

interface ComplianceResult {
  score: number
  rating: 'good' | 'requires-improvement' | 'inadequate'
  items: ComplianceItem[]
  summary: {
    total: number
    compliant: number
    warnings: number
    nonCompliant: number
  }
  categories: {
    dbs: number
    training: number
    supervision: number
    rightToWork: number
    visits: number
    medication: number
    documentation: number
  }
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

    if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'superadmin') {
      res.status(403).json({ error: 'Managers only' })
      return
    }

    const slug = getTenantSlug(req)
    let tenantId: string | null = null
    if (slug) {
      const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1` as any[]
      tenantId = tenantRows[0]?.id || null
    }

    const items: ComplianceItem[] = []
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Helper to build tenant-scoped query
    const tScope = (extra: string) => tenantId ? `${extra} AND tenant_id = '${tenantId}'` : extra

    // 1. DBS checks
    try {
      let dbsRows: any[]
      if (tenantId) {
        dbsRows = await sql`
          SELECT user_id, status, expiry_date, issue_date, checked_at
          FROM dbs_checks
          WHERE tenant_id = ${tenantId}
        ` as any[]
      } else {
        dbsRows = await sql`SELECT user_id, status, expiry_date, issue_date, checked_at FROM dbs_checks` as any[]
      }

      for (const dbs of dbsRows) {
        if (dbs.status === 'expired' || (dbs.expiry_date && new Date(dbs.expiry_date) < now)) {
          items.push({
            category: 'dbs',
            item: `DBS check expired`,
            status: 'non-compliant',
            detail: `DBS for user ${dbs.user_id} has expired`,
            dueDate: dbs.expiry_date,
            cqcStatement: 'Safe recruitment practices including DBS checks',
          })
        } else if (dbs.expiry_date && new Date(dbs.expiry_date) < thirtyDaysFromNow) {
          items.push({
            category: 'dbs',
            item: `DBS check expiring soon`,
            status: 'warning',
            detail: `DBS for user ${dbs.user_id} expires on ${dbs.expiry_date}`,
            dueDate: dbs.expiry_date,
            cqcStatement: 'Safe recruitment practices including DBS checks',
          })
        } else if (!dbs.status || dbs.status === 'pending') {
          items.push({
            category: 'dbs',
            item: `DBS check pending`,
            status: 'warning',
            detail: `DBS check for user ${dbs.user_id} is pending`,
            cqcStatement: 'Safe recruitment practices including DBS checks',
          })
        }
      }
    } catch (e: any) {
      // Table might not exist
    }

    // 2. Training expiry
    try {
      let trainingRows: any[]
      if (tenantId) {
        trainingRows = await sql`
          SELECT user_id, course_name, status, expiry_date, completed_date
          FROM training_records
          WHERE tenant_id = ${tenantId}
        ` as any[]
      } else {
        trainingRows = await sql`SELECT user_id, course_name, status, expiry_date, completed_date FROM training_records` as any[]
      }

      for (const t of trainingRows) {
        if (t.status === 'expired' || (t.expiry_date && new Date(t.expiry_date) < now)) {
          items.push({
            category: 'training',
            item: `Training expired: ${t.course_name}`,
            status: 'non-compliant',
            detail: `${t.course_name} for user ${t.user_id} has expired`,
            dueDate: t.expiry_date,
            cqcStatement: 'Staff training and development',
          })
        } else if (t.expiry_date && new Date(t.expiry_date) < thirtyDaysFromNow) {
          items.push({
            category: 'training',
            item: `Training expiring: ${t.course_name}`,
            status: 'warning',
            detail: `${t.course_name} for user ${t.user_id} expires on ${t.expiry_date}`,
            dueDate: t.expiry_date,
            cqcStatement: 'Staff training and development',
          })
        }
      }
    } catch (e: any) {}

    // 3. Supervision due
    try {
      let supRows: any[]
      if (tenantId) {
        supRows = await sql`
          SELECT user_id, last_date, next_due_date, status
          FROM supervisions
          WHERE tenant_id = ${tenantId}
        ` as any[]
      } else {
        supRows = await sql`SELECT user_id, last_date, next_due_date, status FROM supervisions` as any[]
      }

      for (const s of supRows) {
        if (s.status === 'overdue' || (s.next_due_date && new Date(s.next_due_date) < now)) {
          items.push({
            category: 'supervision',
            item: `Supervision overdue`,
            status: 'non-compliant',
            detail: `Supervision for user ${s.user_id} was due on ${s.next_due_date}`,
            dueDate: s.next_due_date,
            cqcStatement: 'Staff support and supervision',
          })
        } else if (s.next_due_date && new Date(s.next_due_date) < thirtyDaysFromNow) {
          items.push({
            category: 'supervision',
            item: `Supervision due soon`,
            status: 'warning',
            detail: `Supervision for user ${s.user_id} due on ${s.next_due_date}`,
            dueDate: s.next_due_date,
            cqcStatement: 'Staff support and supervision',
          })
        }
      }
    } catch (e: any) {}

    // 4. Right to work
    try {
      let rtwRows: any[]
      if (tenantId) {
        rtwRows = await sql`
          SELECT user_id, status, expiry_date, checked_date
          FROM right_to_work
          WHERE tenant_id = ${tenantId}
        ` as any[]
      } else {
        rtwRows = await sql`SELECT user_id, status, expiry_date, checked_date FROM right_to_work` as any[]
      }

      for (const r of rtwRows) {
        if (r.status === 'expired' || (r.expiry_date && new Date(r.expiry_date) < now)) {
          items.push({
            category: 'rightToWork',
            item: `Right to work expired`,
            status: 'non-compliant',
            detail: `Right to work check for user ${r.user_id} has expired`,
            dueDate: r.expiry_date,
            cqcStatement: 'Safe recruitment and employment checks',
          })
        } else if (r.expiry_date && new Date(r.expiry_date) < thirtyDaysFromNow) {
          items.push({
            category: 'rightToWork',
            item: `Right to work expiring`,
            status: 'warning',
            detail: `Right to work for user ${r.user_id} expires on ${r.expiry_date}`,
            dueDate: r.expiry_date,
            cqcStatement: 'Safe recruitment and employment checks',
          })
        }
      }
    } catch (e: any) {}

    // 5. Missed visits
    try {
      let missedCount = 0
      if (tenantId) {
        const missed = await sql`
          SELECT COUNT(*) as count FROM visits
          WHERE tenant_id = ${tenantId}
            AND status = 'missed'
            AND clock_in_at >= ${sevenDaysAgo.toISOString()}
        ` as any[]
        missedCount = parseInt(missed[0]?.count || '0', 10)
      } else {
        const missed = await sql`
          SELECT COUNT(*) as count FROM visits
          WHERE status = 'missed'
            AND clock_in_at >= ${sevenDaysAgo.toISOString()}
        ` as any[]
        missedCount = parseInt(missed[0]?.count || '0', 10)
      }

      if (missedCount > 0) {
        items.push({
          category: 'visits',
          item: `${missedCount} missed visit(s) in last 7 days`,
          status: missedCount > 3 ? 'non-compliant' : 'warning',
          detail: `${missedCount} visits were missed in the past 7 days`,
          cqcStatement: 'Safe care and treatment - visits delivered as planned',
        })
      }
    } catch (e: any) {}

    // 6. Unsigned medication records
    try {
      let unsignedMedCount = 0
      if (tenantId) {
        const unsigned = await sql`
          SELECT COUNT(*) as count FROM visits
          WHERE tenant_id = ${tenantId}
            AND status = 'completed'
            AND medications IS NOT NULL
            AND medications::text != '[]'
            AND medications::text != 'null'
            AND med_signed_off = false
            AND clock_in_at >= ${sevenDaysAgo.toISOString()}
        ` as any[]
        unsignedMedCount = parseInt(unsigned[0]?.count || '0', 10)
      }

      if (unsignedMedCount > 0) {
        items.push({
          category: 'medication',
          item: `${unsignedMedCount} unsigned medication record(s)`,
          status: unsignedMedCount > 2 ? 'non-compliant' : 'warning',
          detail: `${unsignedMedCount} visits have medication administered but not signed off in the last 7 days`,
          cqcStatement: 'Managing medicines safely',
        })
      }
    } catch (e: any) {}

    // 7. Visit notes not completed
    try {
      let noNotesCount = 0
      if (tenantId) {
        const noNotes = await sql`
          SELECT COUNT(*) as count FROM visits
          WHERE tenant_id = ${tenantId}
            AND status = 'completed'
            AND (notes IS NULL OR notes = '')
            AND clock_in_at >= ${sevenDaysAgo.toISOString()}
        ` as any[]
        noNotesCount = parseInt(noNotes[0]?.count || '0', 10)
      }

      if (noNotesCount > 0) {
        items.push({
          category: 'documentation',
          item: `${noNotesCount} visit(s) without notes`,
          status: noNotesCount > 5 ? 'non-compliant' : 'warning',
          detail: `${noNotesCount} completed visits in the last 7 days have no notes recorded`,
          cqcStatement: 'Good governance - records and documentation',
        })
      }
    } catch (e: any) {}

    // 8. Incidents in last 30 days
    try {
      let incidentCount = 0
      if (tenantId) {
        const incidents = await sql`
          SELECT COUNT(*) as count FROM incidents
          WHERE tenant_id = ${tenantId}
            AND created_at >= ${thirtyDaysAgo.toISOString()}
        ` as any[]
        incidentCount = parseInt(incidents[0]?.count || '0', 10)
      }

      if (incidentCount > 0) {
        items.push({
          category: 'documentation',
          item: `${incidentCount} incident(s) in last 30 days`,
          status: incidentCount > 5 ? 'warning' : 'compliant',
          detail: `${incidentCount} incidents recorded in the last 30 days. Review patterns and ensure CQC notifications where required.`,
          cqcStatement: 'Safeguarding and incident management',
        })
      }
    } catch (e: any) {}

    // Calculate score
    const total = items.length
    const compliant = items.filter(i => i.status === 'compliant').length
    const warnings = items.filter(i => i.status === 'warning').length
    const nonCompliant = items.filter(i => i.status === 'non-compliant').length

    // Score: 100 - (nonCompliant * 15) - (warnings * 5), clamped 0-100
    const score = Math.max(0, Math.min(100, 100 - (nonCompliant * 15) - (warnings * 5)))
    const rating: ComplianceResult['rating'] = score >= 85 ? 'good' : score >= 60 ? 'requires-improvement' : 'inadequate'

    // Category scores
    const categories = {
      dbs: items.filter(i => i.category === 'dbs').filter(i => i.status === 'non-compliant').length === 0 ? 100 : 60,
      training: items.filter(i => i.category === 'training').filter(i => i.status === 'non-compliant').length === 0 ? 100 : 60,
      supervision: items.filter(i => i.category === 'supervision').filter(i => i.status === 'non-compliant').length === 0 ? 100 : 60,
      rightToWork: items.filter(i => i.category === 'rightToWork').filter(i => i.status === 'non-compliant').length === 0 ? 100 : 60,
      visits: items.filter(i => i.category === 'visits').filter(i => i.status === 'non-compliant').length === 0 ? 100 : 50,
      medication: items.filter(i => i.category === 'medication').filter(i => i.status === 'non-compliant').length === 0 ? 100 : 50,
      documentation: items.filter(i => i.category === 'documentation').filter(i => i.status === 'non-compliant').length === 0 ? 100 : 60,
    }

    const result: ComplianceResult = {
      score,
      rating,
      items: items.sort((a, b) => {
        const order = { 'non-compliant': 0, 'warning': 1, 'compliant': 2 }
        return order[a.status] - order[b.status]
      }),
      summary: { total, compliant, warnings, nonCompliant },
      categories,
    }

    res.status(200).json(result)
  } catch (err: any) {
    console.error('[compliance/dashboard] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
