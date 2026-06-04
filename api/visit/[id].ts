import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from '../_utils/db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  const visitId = Array.isArray(id) ? id[0] : id

  if (!visitId) {
    res.status(400).json({ error: 'Visit ID required' })
    return
  }

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM visits WHERE id = ${visitId}`
    res.status(200).json(rows[0] || { id: visitId, status: 'pending', data: null })
    return
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = req.body || {}
    const {
      clientName, clientAge, clientAddress, visitTime, visitDuration,
      elapsed, tasks, fluid, notes, medications, handoverNote, clockOutAt,
    } = body

    await sql`
      INSERT INTO visits (
        id, client_name, client_age, client_address, visit_time, visit_duration,
        elapsed, tasks, fluid, notes, medications, handover_note, clock_out_at
      ) VALUES (
        ${visitId}, ${clientName}, ${clientAge}, ${clientAddress}, ${visitTime}, ${visitDuration},
        ${elapsed}, ${JSON.stringify(tasks || [])}, ${fluid}, ${notes}, ${JSON.stringify(medications || [])}, ${handoverNote}, ${clockOutAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        client_name = EXCLUDED.client_name,
        client_age = EXCLUDED.client_age,
        client_address = EXCLUDED.client_address,
        visit_time = EXCLUDED.visit_time,
        visit_duration = EXCLUDED.visit_duration,
        elapsed = EXCLUDED.elapsed,
        tasks = EXCLUDED.tasks,
        fluid = EXCLUDED.fluid,
        notes = EXCLUDED.notes,
        medications = EXCLUDED.medications,
        handover_note = EXCLUDED.handover_note,
        clock_out_at = EXCLUDED.clock_out_at,
        submitted_at = NOW()
    `
    res.status(200).json({ status: 'saved', visitId })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
