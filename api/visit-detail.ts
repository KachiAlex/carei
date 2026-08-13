import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { id: visitId } = req.query as { id?: string }

  if (!visitId) {
    res.status(400).json({ error: 'Visit ID required' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    // If tenant slug provided, use tenant-aware filtering
    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        if (req.method === 'GET') {
          const rows = await tenantSql`SELECT * FROM visits WHERE id = ${visitId} AND tenant_id = ${tenantId}`
          if (rows[0]) {
            const r = rows[0] as any
            res.status(200).json({ ...r, clientId: r.client_id || r.clientId })
            return
          }
          const scheduled = await tenantSql`
            SELECT id, client_id AS "clientId", client_name AS "clientName", time, duration, status, tasks, flags
            FROM scheduled_visits WHERE id = ${visitId} AND tenant_id = ${tenantId}
          `
          if (scheduled[0]) {
            res.status(200).json({ ...scheduled[0], status: 'pending' })
            return
          }

          const assignment = await tenantSql`
            SELECT
              a.id, c.id AS "clientId", c.name AS "clientName", c.age AS "clientAge",
              c.address AS "clientAddress", c.conditions, c.medications, c.preferences,
              c.emergency_contact AS "emergencyContact", a.visit_time AS time,
              '60' AS duration, 'pending' AS status,
              ARRAY[COALESCE(a.instructions, 'Follow care plan')] AS tasks,
              COALESCE(c.conditions, '[]'::jsonb) AS flags
            FROM caregiver_client_assignments a
            JOIN clients c ON a.client_id = c.id AND c.tenant_id = ${tenantId}
            WHERE a.id = ${visitId} AND a.tenant_id = ${tenantId}
            LIMIT 1
          ` as any[]
          if (assignment[0]) {
            res.status(200).json(assignment[0])
            return
          }

          res.status(404).json({ error: 'Visit not found' })
          return
        }

        if (req.method === 'POST' || req.method === 'PATCH') {
          const body = req.body || {}
          const {
            clientName, clientAge, clientAddress, clientId, visitTime, visitDuration,
            elapsed, tasks, fluid, notes, medications, handoverNote, clockOutAt, clockInAt, status,
            bpSystolic, bpDiastolic, pulse, o2Sat, fluidGlasses, mealStatus, mood, wellbeingNote,
            clockInLat, clockInLng, clockInAccuracy, geoVerified, geoDistanceM, geoOverrideReason,
            tagScanId, tagScanMethod, tagScannedAt, tagVerified,
          } = body

          await tenantSql`
            INSERT INTO visits (
              id, tenant_id, client_name, client_age, client_address, client_id, visit_time, visit_duration,
              elapsed, tasks, fluid, notes, medications, handover_note, clock_out_at, clock_in_at, status,
              bp_systolic, bp_diastolic, pulse, o2_sat, fluid_glasses, meal_status, mood, wellbeing_note,
              clock_in_lat, clock_in_lng, clock_in_accuracy, geo_verified, geo_distance_m, geo_override_reason,
              tag_scan_id, tag_scan_method, tag_scanned_at, tag_verified
            ) VALUES (
              ${visitId}, ${tenantId}, ${clientName}, ${clientAge}, ${clientAddress}, ${clientId || null}, ${visitTime}, ${visitDuration},
              ${elapsed}, ${JSON.stringify(tasks || [])}, ${fluid}, ${notes}, ${JSON.stringify(medications || [])}, ${handoverNote}, ${clockOutAt}, ${clockInAt}, ${status || 'pending'},
              ${bpSystolic}, ${bpDiastolic}, ${pulse}, ${o2Sat}, ${fluidGlasses}, ${mealStatus}, ${mood}, ${wellbeingNote},
              ${clockInLat ?? null}, ${clockInLng ?? null}, ${clockInAccuracy ?? null}, ${geoVerified ?? false}, ${geoDistanceM ?? null}, ${geoOverrideReason ?? null},
              ${tagScanId ?? null}, ${tagScanMethod ?? null}, ${tagScannedAt ?? null}, ${tagVerified ?? false}
            )
            ON CONFLICT (id) DO UPDATE SET
              client_name = EXCLUDED.client_name,
              client_age = EXCLUDED.client_age,
              client_address = EXCLUDED.client_address,
              client_id = EXCLUDED.client_id,
              visit_time = EXCLUDED.visit_time,
              visit_duration = EXCLUDED.visit_duration,
              elapsed = EXCLUDED.elapsed,
              tasks = EXCLUDED.tasks,
              fluid = EXCLUDED.fluid,
              notes = EXCLUDED.notes,
              medications = EXCLUDED.medications,
              handover_note = EXCLUDED.handover_note,
              clock_out_at = EXCLUDED.clock_out_at,
              clock_in_at = EXCLUDED.clock_in_at,
              status = EXCLUDED.status,
              bp_systolic = EXCLUDED.bp_systolic,
              bp_diastolic = EXCLUDED.bp_diastolic,
              pulse = EXCLUDED.pulse,
              o2_sat = EXCLUDED.o2_sat,
              fluid_glasses = EXCLUDED.fluid_glasses,
              meal_status = EXCLUDED.meal_status,
              mood = EXCLUDED.mood,
              wellbeing_note = EXCLUDED.wellbeing_note,
              clock_in_lat = COALESCE(EXCLUDED.clock_in_lat, visits.clock_in_lat),
              clock_in_lng = COALESCE(EXCLUDED.clock_in_lng, visits.clock_in_lng),
              clock_in_accuracy = COALESCE(EXCLUDED.clock_in_accuracy, visits.clock_in_accuracy),
              geo_verified = EXCLUDED.geo_verified,
              geo_distance_m = COALESCE(EXCLUDED.geo_distance_m, visits.geo_distance_m),
              geo_override_reason = COALESCE(EXCLUDED.geo_override_reason, visits.geo_override_reason),
              tag_scan_id = COALESCE(EXCLUDED.tag_scan_id, visits.tag_scan_id),
              tag_scan_method = COALESCE(EXCLUDED.tag_scan_method, visits.tag_scan_method),
              tag_scanned_at = COALESCE(EXCLUDED.tag_scanned_at, visits.tag_scanned_at),
              tag_verified = EXCLUDED.tag_verified,
              submitted_at = NOW()
          `
          res.status(200).json({ status: 'saved', visitId })
          return
        }

        res.status(405).json({ error: 'Method not allowed' })
      })
      return
    }

    // Legacy non-tenant handler
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM visits WHERE id = ${visitId}`
      if (rows[0]) {
        const r = rows[0] as any
        res.status(200).json({ ...r, clientId: r.client_id || r.clientId })
        return
      }
      const scheduled = await sql`
        SELECT id, client_id AS "clientId", client_name AS "clientName", time, duration, status, tasks, flags
        FROM scheduled_visits WHERE id = ${visitId}
      `
      if (scheduled[0]) {
        res.status(200).json({ ...scheduled[0], status: 'pending' })
        return
      }

      const assignment = await sql`
        SELECT
          a.id, c.id AS "clientId", c.name AS "clientName", c.age AS "clientAge",
          c.address AS "clientAddress", c.conditions, c.medications, c.preferences,
          c.emergency_contact AS "emergencyContact", a.visit_time AS time,
          '60' AS duration, 'pending' AS status,
          ARRAY[COALESCE(a.instructions, 'Follow care plan')] AS tasks,
          COALESCE(c.conditions, '[]'::jsonb) AS flags
        FROM caregiver_client_assignments a
        JOIN clients c ON a.client_id = c.id
        WHERE a.id = ${visitId} LIMIT 1
      ` as any[]
      if (assignment[0]) {
        res.status(200).json(assignment[0])
        return
      }

      res.status(404).json({ error: 'Visit not found' })
      return
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const body = req.body || {}
      const {
        clientName, clientAge, clientAddress, clientId, visitTime, visitDuration,
        elapsed, tasks, fluid, notes, medications, handoverNote, clockOutAt, clockInAt, status,
        bpSystolic, bpDiastolic, pulse, o2Sat, fluidGlasses, mealStatus, mood, wellbeingNote,
        clockInLat, clockInLng, clockInAccuracy, geoVerified, geoDistanceM, geoOverrideReason,
        tagScanId, tagScanMethod, tagScannedAt, tagVerified,
      } = body

      await sql`
        INSERT INTO visits (
          id, client_name, client_age, client_address, client_id, visit_time, visit_duration,
          elapsed, tasks, fluid, notes, medications, handover_note, clock_out_at, clock_in_at, status,
          bp_systolic, bp_diastolic, pulse, o2_sat, fluid_glasses, meal_status, mood, wellbeing_note,
          clock_in_lat, clock_in_lng, clock_in_accuracy, geo_verified, geo_distance_m, geo_override_reason,
          tag_scan_id, tag_scan_method, tag_scanned_at, tag_verified
        ) VALUES (
          ${visitId}, ${clientName}, ${clientAge}, ${clientAddress}, ${clientId || null}, ${visitTime}, ${visitDuration},
          ${elapsed}, ${JSON.stringify(tasks || [])}, ${fluid}, ${notes}, ${JSON.stringify(medications || [])}, ${handoverNote}, ${clockOutAt}, ${clockInAt}, ${status || 'pending'},
          ${bpSystolic}, ${bpDiastolic}, ${pulse}, ${o2Sat}, ${fluidGlasses}, ${mealStatus}, ${mood}, ${wellbeingNote},
          ${clockInLat ?? null}, ${clockInLng ?? null}, ${clockInAccuracy ?? null}, ${geoVerified ?? false}, ${geoDistanceM ?? null}, ${geoOverrideReason ?? null},
          ${tagScanId ?? null}, ${tagScanMethod ?? null}, ${tagScannedAt ?? null}, ${tagVerified ?? false}
        )
        ON CONFLICT (id) DO UPDATE SET
          client_name = EXCLUDED.client_name,
          client_age = EXCLUDED.client_age,
          client_address = EXCLUDED.client_address,
          client_id = EXCLUDED.client_id,
          visit_time = EXCLUDED.visit_time,
          visit_duration = EXCLUDED.visit_duration,
          elapsed = EXCLUDED.elapsed,
          tasks = EXCLUDED.tasks,
          fluid = EXCLUDED.fluid,
          notes = EXCLUDED.notes,
          medications = EXCLUDED.medications,
          handover_note = EXCLUDED.handover_note,
          clock_out_at = EXCLUDED.clock_out_at,
          clock_in_at = EXCLUDED.clock_in_at,
          status = EXCLUDED.status,
          bp_systolic = EXCLUDED.bp_systolic,
          bp_diastolic = EXCLUDED.bp_diastolic,
          pulse = EXCLUDED.pulse,
          o2_sat = EXCLUDED.o2_sat,
          fluid_glasses = EXCLUDED.fluid_glasses,
          meal_status = EXCLUDED.meal_status,
          mood = EXCLUDED.mood,
          wellbeing_note = EXCLUDED.wellbeing_note,
          clock_in_lat = COALESCE(EXCLUDED.clock_in_lat, visits.clock_in_lat),
          clock_in_lng = COALESCE(EXCLUDED.clock_in_lng, visits.clock_in_lng),
          clock_in_accuracy = COALESCE(EXCLUDED.clock_in_accuracy, visits.clock_in_accuracy),
          geo_verified = EXCLUDED.geo_verified,
          geo_distance_m = COALESCE(EXCLUDED.geo_distance_m, visits.geo_distance_m),
          geo_override_reason = COALESCE(EXCLUDED.geo_override_reason, visits.geo_override_reason),
          tag_scan_id = COALESCE(EXCLUDED.tag_scan_id, visits.tag_scan_id),
          tag_scan_method = COALESCE(EXCLUDED.tag_scan_method, visits.tag_scan_method),
          tag_scanned_at = COALESCE(EXCLUDED.tag_scanned_at, visits.tag_scanned_at),
          tag_verified = EXCLUDED.tag_verified,
          submitted_at = NOW()
      `
      res.status(200).json({ status: 'saved', visitId })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
