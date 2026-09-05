import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, getAuthToken, getUserFromToken, getTenantSlug } from './db.js'

interface RiskAlert {
  clientId: string
  clientName: string
  alertType: string
  severity: 'low' | 'medium' | 'high'
  message: string
  detail: string
  triggeredAt: string
  data: Record<string, any>
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

    const alerts: RiskAlert[] = []
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Helper for tenant-scoped queries
    const tenantFilter = tenantId ? sql`AND tenant_id = ${tenantId}` : sql``

    // 1. Fall risk: 3+ falls in 30 days
    try {
      let fallRows: any[]
      if (tenantId) {
        fallRows = await sql`
          SELECT client_id, client_name, COUNT(*) as fall_count
          FROM incidents
          WHERE tenant_id = ${tenantId}
            AND type = 'fall'
            AND created_at >= ${thirtyDaysAgo.toISOString()}
          GROUP BY client_id, client_name
          HAVING COUNT(*) >= 3
        ` as any[]
      } else {
        fallRows = await sql`
          SELECT client_id, client_name, COUNT(*) as fall_count
          FROM incidents
          WHERE type = 'fall'
            AND created_at >= ${thirtyDaysAgo.toISOString()}
          GROUP BY client_id, client_name
          HAVING COUNT(*) >= 3
        ` as any[]
      }

      for (const f of fallRows) {
        alerts.push({
          clientId: f.client_id,
          clientName: f.client_name || 'Unknown',
          alertType: 'repeated-falls',
          severity: 'high',
          message: `${f.fall_count} falls in 30 days`,
          detail: `${f.client_name} has had ${f.fall_count} falls in the last 30 days. Review mobility, environment, and consider a falls assessment.`,
          triggeredAt: now.toISOString(),
          data: { fallCount: parseInt(f.fall_count, 10), window: '30d' },
        })
      }
    } catch (e: any) {}

    // 2. Medication errors in last 7 days
    try {
      let medErrorRows: any[]
      if (tenantId) {
        medErrorRows = await sql`
          SELECT client_id, client_name, COUNT(*) as error_count
          FROM incidents
          WHERE tenant_id = ${tenantId}
            AND type = 'medication_error'
            AND created_at >= ${sevenDaysAgo.toISOString()}
          GROUP BY client_id, client_name
          HAVING COUNT(*) >= 1
        ` as any[]
      } else {
        medErrorRows = await sql`
          SELECT client_id, client_name, COUNT(*) as error_count
          FROM incidents
          WHERE type = 'medication_error'
            AND created_at >= ${sevenDaysAgo.toISOString()}
          GROUP BY client_id, client_name
          HAVING COUNT(*) >= 1
        ` as any[]
      }

      for (const m of medErrorRows) {
        alerts.push({
          clientId: m.client_id,
          clientName: m.client_name || 'Unknown',
          alertType: 'medication-error',
          severity: m.error_count >= 2 ? 'high' : 'medium',
          message: `${m.error_count} medication error(s) in 7 days`,
          detail: `${m.client_name} has had ${m.error_count} medication error(s) in the last 7 days. Review MAR chart and medication procedure.`,
          triggeredAt: now.toISOString(),
          data: { errorCount: parseInt(m.error_count, 10), window: '7d' },
        })
      }
    } catch (e: any) {}

    // 3. Mood decline: 3+ consecutive low mood visits
    try {
      let moodRows: any[]
      if (tenantId) {
        moodRows = await sql`
          SELECT client_id, client_name, mood, clock_in_at
          FROM visits
          WHERE tenant_id = ${tenantId}
            AND status = 'completed'
            AND mood IS NOT NULL
            AND mood != ''
          ORDER BY client_id, clock_in_at DESC
        ` as any[]
      } else {
        moodRows = await sql`
          SELECT client_id, client_name, mood, clock_in_at
          FROM visits
          WHERE status = 'completed'
            AND mood IS NOT NULL
            AND mood != ''
          ORDER BY client_id, clock_in_at DESC
        ` as any[]
      }

      // Group by client and check for declining trend
      const byClient = new Map<string, any[]>()
      for (const v of moodRows) {
        if (!byClient.has(v.client_id)) byClient.set(v.client_id, [])
        byClient.get(v.client_id)!.push(v)
      }

      const lowMoods = ['low', 'distressed', 'sad', 'depressed', 'anxious']
      for (const [clientId, visits] of byClient) {
        const recent3 = visits.slice(0, 3)
        if (recent3.length === 3 && recent3.every(v => lowMoods.some(lm => v.mood?.toLowerCase().includes(lm)))) {
          alerts.push({
            clientId,
            clientName: recent3[0].client_name || 'Unknown',
            alertType: 'mood-decline',
            severity: 'medium',
            message: 'Mood declining over last 3 visits',
            detail: `${recent3[0].client_name} has recorded low mood (${recent3.map(v => v.mood).join(', ')}) in the last 3 visits. Consider wellbeing review.`,
            triggeredAt: now.toISOString(),
            data: { moods: recent3.map(v => v.mood), dates: recent3.map(v => v.clock_in_at) },
          })
        }
      }
    } catch (e: any) {}

    // 4. Poor appetite/fluid intake: 3+ consecutive poor records
    try {
      let intakeRows: any[]
      if (tenantId) {
        intakeRows = await sql`
          SELECT client_id, client_name, meal_status, fluid, clock_in_at
          FROM visits
          WHERE tenant_id = ${tenantId}
            AND status = 'completed'
            AND (meal_status IS NOT NULL OR fluid IS NOT NULL)
          ORDER BY client_id, clock_in_at DESC
        ` as any[]
      } else {
        intakeRows = await sql`
          SELECT client_id, client_name, meal_status, fluid, clock_in_at
          FROM visits
          WHERE status = 'completed'
            AND (meal_status IS NOT NULL OR fluid IS NOT NULL)
          ORDER BY client_id, clock_in_at DESC
        ` as any[]
      }

      const byClient = new Map<string, any[]>()
      for (const v of intakeRows) {
        if (!byClient.has(v.client_id)) byClient.set(v.client_id, [])
        byClient.get(v.client_id)!.push(v)
      }

      const poorIntake = ['poor', 'none', 'low', 'minimal', 'refused']
      for (const [clientId, visits] of byClient) {
        const recent3 = visits.slice(0, 3)
        if (recent3.length === 3) {
          const poorMeals = recent3.filter(v => poorIntake.some(p => v.meal_status?.toLowerCase().includes(p)))
          const poorFluid = recent3.filter(v => poorIntake.some(p => v.fluid?.toLowerCase().includes(p)))
          if (poorMeals.length >= 3) {
            alerts.push({
              clientId,
              clientName: recent3[0].client_name || 'Unknown',
              alertType: 'poor-appetite',
              severity: 'medium',
              message: 'Poor appetite over last 3 visits',
              detail: `${recent3[0].client_name} has had poor meal intake (${recent3.map(v => v.meal_status).join(', ')}) in the last 3 visits. Consider nutritional review.`,
              triggeredAt: now.toISOString(),
              data: { mealStatuses: recent3.map(v => v.meal_status) },
            })
          }
          if (poorFluid.length >= 3) {
            alerts.push({
              clientId,
              clientName: recent3[0].client_name || 'Unknown',
              alertType: 'low-fluid-intake',
              severity: 'medium',
              message: 'Low fluid intake over last 3 visits',
              detail: `${recent3[0].client_name} has had low fluid intake (${recent3.map(v => v.fluid).join(', ')}) in the last 3 visits. Risk of dehydration.`,
              triggeredAt: now.toISOString(),
              data: { fluidLevels: recent3.map(v => v.fluid) },
            })
          }
        }
      }
    } catch (e: any) {}

    // 5. Missed visits pattern: 2+ missed in 7 days for same client
    try {
      let missedRows: any[]
      if (tenantId) {
        missedRows = await sql`
          SELECT client_id, client_name, COUNT(*) as missed_count
          FROM visits
          WHERE tenant_id = ${tenantId}
            AND status = 'missed'
            AND clock_in_at >= ${sevenDaysAgo.toISOString()}
          GROUP BY client_id, client_name
          HAVING COUNT(*) >= 2
        ` as any[]
      } else {
        missedRows = await sql`
          SELECT client_id, client_name, COUNT(*) as missed_count
          FROM visits
          WHERE status = 'missed'
            AND clock_in_at >= ${sevenDaysAgo.toISOString()}
          GROUP BY client_id, client_name
          HAVING COUNT(*) >= 2
        ` as any[]
      }

      for (const m of missedRows) {
        alerts.push({
          clientId: m.client_id,
          clientName: m.client_name || 'Unknown',
          alertType: 'repeated-missed-visits',
          severity: 'high',
          message: `${m.missed_count} missed visits in 7 days`,
          detail: `${m.client_name} has had ${m.missed_count} missed visits in the last 7 days. Review scheduling and carer availability.`,
          triggeredAt: now.toISOString(),
          data: { missedCount: parseInt(m.missed_count, 10), window: '7d' },
        })
      }
    } catch (e: any) {}

    // Sort by severity (high first)
    const severityOrder = { high: 0, medium: 1, low: 2 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    res.status(200).json({
      alerts,
      totalAlerts: alerts.length,
      highSeverity: alerts.filter(a => a.severity === 'high').length,
      mediumSeverity: alerts.filter(a => a.severity === 'medium').length,
      lowSeverity: alerts.filter(a => a.severity === 'low').length,
    })
  } catch (err: any) {
    console.error('[risk-alerts] error:', err)
    res.status(500).json({ error: 'Internal error', detail: err.message })
  }
}
