import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, ensureTables, withTenant, getTenantSlug } from '../db.js'

async function safeQuery(sql: any, query: any, fallback: any[] = []) {
  try {
    return await query
  } catch { return fallback }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const tenantSlug = getTenantSlug(req)
  if (!tenantSlug) {
    res.status(400).json({ error: 'Tenant slug required' })
    return
  }

  try {
    await ensureTables()
    await withTenant(req, res, async ({ tenantId, sql }) => {
      const today = new Date().toISOString().split('T')[0]

      // Run all queries in parallel for maximum performance
      const [
        visitsToday, visitsCompleted, visitsInProgress, visitsPending,
        scheduledToday, scheduledCompleted, scheduledPending,
        carers, activeCarers,
        alerts, incidents,
        medicationsToday, medConfirmed, medSkipped,
        dbsRecords, dbsSummary,
        trainingRecords, trainingSummary,
        rtwRecords, rtwSummary,
        leavePending, leaveApprovedToday,
        upcomingSupervisions,
        unreadMessages,
        clientsCount,
      ] = await Promise.all([
        // Visit stats
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM visits WHERE tenant_id = ${tenantId} AND DATE(submitted_at) = CURRENT_DATE`, [{ cnt: 0 }]),
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM visits WHERE tenant_id = ${tenantId} AND DATE(submitted_at) = CURRENT_DATE AND status = 'completed'`, [{ cnt: 0 }]),
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM visits WHERE tenant_id = ${tenantId} AND DATE(submitted_at) = CURRENT_DATE AND status = 'in-progress'`, [{ cnt: 0 }]),
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM visits WHERE tenant_id = ${tenantId} AND DATE(submitted_at) = CURRENT_DATE AND status = 'pending'`, [{ cnt: 0 }]),

        // Scheduled visits today
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM scheduled_visits WHERE tenant_id = ${tenantId} AND visit_date = ${today}`, [{ cnt: 0 }]),
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM scheduled_visits WHERE tenant_id = ${tenantId} AND visit_date = ${today} AND status = 'completed'`, [{ cnt: 0 }]),
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM scheduled_visits WHERE tenant_id = ${tenantId} AND visit_date = ${today} AND status = 'pending'`, [{ cnt: 0 }]),

        // Carer stats
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM users WHERE role = 'carer' AND tenant_id = ${tenantId}`, [{ cnt: 0 }]),
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM users WHERE role = 'carer' AND tenant_id = ${tenantId} AND status = 'active'`, [{ cnt: 0 }]),

        // Alerts & incidents
        safeQuery(sql, sql`SELECT * FROM sos_alerts WHERE tenant_id = ${tenantId} AND resolved = FALSE ORDER BY timestamp DESC LIMIT 10`, []),
        safeQuery(sql, sql`SELECT * FROM incidents WHERE tenant_id = ${tenantId} AND resolved = FALSE ORDER BY timestamp DESC LIMIT 10`, []),

        // Medications
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM medication_logs WHERE tenant_id = ${tenantId} AND DATE(administered_at) = CURRENT_DATE`, [{ cnt: 0 }]),
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM medication_logs WHERE tenant_id = ${tenantId} AND DATE(administered_at) = CURRENT_DATE AND status = 'confirmed'`, [{ cnt: 0 }]),
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM medication_logs WHERE tenant_id = ${tenantId} AND DATE(administered_at) = CURRENT_DATE AND status = 'skipped'`, [{ cnt: 0 }]),

        // DBS compliance
        safeQuery(sql, sql`SELECT id, expiry_date, update_service FROM dbs_checks WHERE tenant_id = ${tenantId}`, []),
        null, // computed below

        // Training compliance
        safeQuery(sql, sql`SELECT id, expiry_date FROM training_certifications WHERE tenant_id = ${tenantId}`, []),
        null, // computed below

        // Right-to-work compliance
        safeQuery(sql, sql`SELECT id, passport_expiry, share_code_expiry, visa_expiry, verification_status FROM right_to_work_checks WHERE tenant_id = ${tenantId}`, []),
        null, // computed below

        // Leave requests
        safeQuery(sql, sql`SELECT * FROM leave_requests WHERE tenant_id = ${tenantId} AND status = 'pending' ORDER BY start_date ASC LIMIT 10`, []),
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM leave_requests WHERE tenant_id = ${tenantId} AND status = 'approved' AND start_date <= ${today} AND end_date >= ${today}`, [{ cnt: 0 }]),

        // Upcoming supervisions
        safeQuery(sql, sql`SELECT * FROM supervisions WHERE tenant_id = ${tenantId} AND scheduled_date >= ${today} AND status IN ('scheduled', 'rescheduled') ORDER BY scheduled_date, scheduled_time LIMIT 5`, []),

        // Unread messages (approximate - count unread across all conversations)
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM conversations WHERE tenant_id = ${tenantId} AND (unread_count_1 > 0 OR unread_count_2 > 0)`, [{ cnt: 0 }]),

        // Clients count
        safeQuery(sql, sql`SELECT COUNT(*) as cnt FROM clients WHERE tenant_id = ${tenantId}`, [{ cnt: 0 }]),
      ])

      // Compute DBS summary
      const dbsList = dbsRecords as any[]
      const dbsValid = dbsList.filter((r) => r.update_service || !r.expiry_date || new Date(r.expiry_date) > new Date(Date.now() + 90 * 86400000)).length
      const dbsExpiring = dbsList.filter((r) => !r.update_service && r.expiry_date && new Date(r.expiry_date) <= new Date(Date.now() + 90 * 86400000) && new Date(r.expiry_date) >= new Date()).length
      const dbsExpired = dbsList.filter((r) => !r.update_service && r.expiry_date && new Date(r.expiry_date) < new Date()).length
      const dbsComplianceRate = dbsList.length > 0 ? Math.round((dbsValid / dbsList.length) * 100) : 100

      // Compute training summary
      const trainList = trainingRecords as any[]
      const trainValid = trainList.filter((r) => !r.expiry_date || new Date(r.expiry_date) > new Date(Date.now() + 60 * 86400000)).length
      const trainExpiring = trainList.filter((r) => r.expiry_date && new Date(r.expiry_date) <= new Date(Date.now() + 60 * 86400000) && new Date(r.expiry_date) >= new Date()).length
      const trainExpired = trainList.filter((r) => r.expiry_date && new Date(r.expiry_date) < new Date()).length

      // Compute RTW summary
      const rtwList = rtwRecords as any[]
      const rtwVerified = rtwList.filter((r) => r.verification_status === 'verified').length
      const rtwPending = rtwList.filter((r) => r.verification_status === 'pending').length
      const rtwRejected = rtwList.filter((r) => r.verification_status === 'rejected').length

      // Build alerts list
      const complianceAlerts: any[] = []
      if (dbsExpired > 0) complianceAlerts.push({ type: 'dbs_expired', severity: 'high', message: `${dbsExpired} DBS check(s) expired`, count: dbsExpired })
      if (dbsExpiring > 0) complianceAlerts.push({ type: 'dbs_expiring', severity: 'medium', message: `${dbsExpiring} DBS check(s) expiring soon`, count: dbsExpiring })
      if (trainExpired > 0) complianceAlerts.push({ type: 'train_expired', severity: 'high', message: `${trainExpired} training certification(s) expired`, count: trainExpired })
      if (trainExpiring > 0) complianceAlerts.push({ type: 'train_expiring', severity: 'medium', message: `${trainExpiring} training certification(s) expiring soon`, count: trainExpiring })
      if (rtwPending > 0) complianceAlerts.push({ type: 'rtw_pending', severity: 'medium', message: `${rtwPending} right-to-work check(s) pending verification`, count: rtwPending })
      if (rtwRejected > 0) complianceAlerts.push({ type: 'rtw_rejected', severity: 'high', message: `${rtwRejected} right-to-work check(s) rejected`, count: rtwRejected })
      if ((leavePending as any[]).length > 0) complianceAlerts.push({ type: 'leave_pending', severity: 'medium', message: `${(leavePending as any[]).length} leave request(s) pending approval`, count: (leavePending as any[]).length })
      if ((alerts as any[]).length > 0) complianceAlerts.push({ type: 'sos', severity: 'high', message: `${(alerts as any[]).length} unresolved SOS alert(s)`, count: (alerts as any[]).length })

      res.status(200).json({
        kpis: {
          visitsToday: parseInt(visitsToday[0]?.cnt || '0'),
          visitsCompleted: parseInt(visitsCompleted[0]?.cnt || '0'),
          visitsInProgress: parseInt(visitsInProgress[0]?.cnt || '0'),
          visitsPending: parseInt(visitsPending[0]?.cnt || '0'),
          scheduledToday: parseInt(scheduledToday[0]?.cnt || '0'),
          scheduledCompleted: parseInt(scheduledCompleted[0]?.cnt || '0'),
          scheduledPending: parseInt(scheduledPending[0]?.cnt || '0'),
          completionRate: parseInt(scheduledToday[0]?.cnt || '0') > 0
            ? Math.round((parseInt(scheduledCompleted[0]?.cnt || '0') / parseInt(scheduledToday[0]?.cnt || '0')) * 100)
            : 0,
          carersTotal: parseInt(carers[0]?.cnt || '0'),
          carersActive: parseInt(activeCarers[0]?.cnt || '0'),
          clientsTotal: parseInt(clientsCount[0]?.cnt || '0'),
          medicationsTotal: parseInt(medicationsToday[0]?.cnt || '0'),
          medicationsConfirmed: parseInt(medConfirmed[0]?.cnt || '0'),
          medicationsSkipped: parseInt(medSkipped[0]?.cnt || '0'),
          alertsCount: (alerts as any[]).length + (incidents as any[]).length,
          sosAlerts: (alerts as any[]).length,
          incidents: (incidents as any[]).length,
          leavePendingCount: (leavePending as any[]).length,
          leaveApprovedToday: parseInt(leaveApprovedToday[0]?.cnt || '0'),
          upcomingSupervisions: (upcomingSupervisions as any[]).length,
          unreadConversations: parseInt(unreadMessages[0]?.cnt || '0'),
        },
        compliance: {
          dbs: { total: dbsList.length, valid: dbsValid, expiring: dbsExpiring, expired: dbsExpired, complianceRate: dbsComplianceRate },
          training: { total: trainList.length, valid: trainValid, expiring: trainExpiring, expired: trainExpired },
          rightToWork: { total: rtwList.length, verified: rtwVerified, pending: rtwPending, rejected: rtwRejected },
        },
        alerts: complianceAlerts,
        leaveRequests: leavePending as any[],
        upcomingSupervisions: upcomingSupervisions as any[],
        sosAlerts: alerts as any[],
        incidents: incidents as any[],
      })
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
