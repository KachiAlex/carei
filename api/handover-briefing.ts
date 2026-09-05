import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql, setCors, ensureTables, withTenant, getTenantSlug } from './db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { clientId } = req.query as { clientId?: string }
  if (!clientId) {
    res.status(400).json({ error: 'clientId required' })
    return
  }

  const tenantSlug = getTenantSlug(req)

  try {
    await ensureTables()
    const sql = getSql()

    if (tenantSlug) {
      await withTenant(req, res, async ({ tenantId, sql: tenantSql }) => {
        const rows = await tenantSql`
          SELECT
            id,
            handover_note,
            notes,
            mood,
            wellbeing_note,
            meal_status,
            fluid,
            clock_in_at,
            clock_out_at,
            client_name,
            tasks,
            medications
          FROM visits
          WHERE client_id = ${clientId}
            AND tenant_id = ${tenantId}
            AND status = 'completed'
            AND handover_note IS NOT NULL
            AND handover_note != ''
          ORDER BY clock_out_at DESC
          LIMIT 1
        ` as any[]

        if (rows[0]) {
          const r = rows[0]
          res.status(200).json({
            hasBriefing: true,
            handoverNote: r.handover_note,
            notes: r.notes,
            mood: r.mood,
            wellbeingNote: r.wellbeing_note,
            mealStatus: r.meal_status,
            fluid: r.fluid,
            clockOutAt: r.clock_out_at,
            clientName: r.client_name,
            tasks: r.tasks,
            medications: r.medications,
          })
        } else {
          // Fallback: get most recent completed visit even without handover note
          const fallback = await tenantSql`
            SELECT
              id,
              notes,
              mood,
              wellbeing_note,
              meal_status,
              fluid,
              clock_in_at,
              clock_out_at,
              client_name,
              tasks,
              medications
            FROM visits
            WHERE client_id = ${clientId}
              AND tenant_id = ${tenantId}
              AND status = 'completed'
            ORDER BY clock_out_at DESC
            LIMIT 1
          ` as any[]

          if (fallback[0]) {
            const r = fallback[0]
            res.status(200).json({
              hasBriefing: true,
              handoverNote: null,
              notes: r.notes,
              mood: r.mood,
              wellbeingNote: r.wellbeing_note,
              mealStatus: r.meal_status,
              fluid: r.fluid,
              clockOutAt: r.clock_out_at,
              clientName: r.client_name,
              tasks: r.tasks,
              medications: r.medications,
            })
          } else {
            res.status(200).json({ hasBriefing: false })
          }
        }
      })
      return
    }

    // Legacy non-tenant
    const rows = await sql`
      SELECT
        id,
        handover_note,
        notes,
        mood,
        wellbeing_note,
        meal_status,
        fluid,
        clock_in_at,
        clock_out_at,
        client_name,
        tasks,
        medications
      FROM visits
      WHERE client_id = ${clientId}
        AND status = 'completed'
        AND handover_note IS NOT NULL
        AND handover_note != ''
      ORDER BY clock_out_at DESC
      LIMIT 1
    ` as any[]

    if (rows[0]) {
      const r = rows[0]
      res.status(200).json({
        hasBriefing: true,
        handoverNote: r.handover_note,
        notes: r.notes,
        mood: r.mood,
        wellbeingNote: r.wellbeing_note,
        mealStatus: r.meal_status,
        fluid: r.fluid,
        clockOutAt: r.clock_out_at,
        clientName: r.client_name,
        tasks: r.tasks,
        medications: r.medications,
      })
    } else {
      const fallback = await sql`
        SELECT
          id,
          notes,
          mood,
          wellbeing_note,
          meal_status,
          fluid,
          clock_in_at,
          clock_out_at,
          client_name,
          tasks,
          medications
        FROM visits
        WHERE client_id = ${clientId}
          AND status = 'completed'
        ORDER BY clock_out_at DESC
        LIMIT 1
      ` as any[]

      if (fallback[0]) {
        const r = fallback[0]
        res.status(200).json({
          hasBriefing: true,
          handoverNote: null,
          notes: r.notes,
          mood: r.mood,
          wellbeingNote: r.wellbeing_note,
          mealStatus: r.meal_status,
          fluid: r.fluid,
          clockOutAt: r.clock_out_at,
          clientName: r.client_name,
          tasks: r.tasks,
          medications: r.medications,
        })
      } else {
        res.status(200).json({ hasBriefing: false })
      }
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
