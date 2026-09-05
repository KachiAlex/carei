function escapeCsv(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCsv(filename: string, headers: string[], rows: Record<string, unknown>[]) {
  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(',')),
  ]
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

export function exportVisits(visits: any[]) {
  const headers = ['id', 'client_name', 'carer_name', 'visit_time', 'duration_min', 'status', 'approval_status', 'submitted_at', 'clock_in_at', 'clock_out_at', 'tasks_done', 'medications_confirmed', 'medications_skipped', 'incidents', 'notes']
  const rows = visits.map((v) => ({
    id: v.id,
    client_name: v.client_name || v.clientName,
    carer_name: v.carer_name || v.carerName,
    visit_time: v.visit_time || v.visitTime,
    duration_min: v.elapsed ? Math.round(v.elapsed / 60) : '',
    status: v.status || '',
    approval_status: v.approval_status || '',
    submitted_at: v.submitted_at || v.submittedAt || '',
    clock_in_at: v.clock_in_at || v.clockInAt || '',
    clock_out_at: v.clock_out_at || v.clockOutAt || '',
    tasks_done: Array.isArray(v.tasks) ? v.tasks.filter((t: any) => t.done).length : '',
    medications_confirmed: Array.isArray(v.medications) ? v.medications.filter((m: any) => m.status === 'confirmed' || m.status === 'given').length : '',
    medications_skipped: Array.isArray(v.medications) ? v.medications.filter((m: any) => m.status === 'skipped' || m.status === 'refused').length : '',
    incidents: Array.isArray(v.incidents) ? v.incidents.length : '',
    notes: v.notes || v.handover_note || '',
  }))
  downloadCsv(`carei-visits-${new Date().toISOString().split('T')[0]}.csv`, headers, rows)
}

export function exportCarers(carers: any[]) {
  const headers = ['id', 'name', 'email', 'phone', 'region', 'status', 'role', 'created_at']
  const rows = carers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    region: c.region,
    status: c.status,
    role: c.role,
    created_at: c.created_at || c.createdAt || '',
  }))
  downloadCsv(`carei-carers-${new Date().toISOString().split('T')[0]}.csv`, headers, rows)
}

export function exportClients(clients: any[]) {
  const headers = ['id', 'name', 'age', 'address', 'conditions', 'allergies', 'emergency_contact', 'support_framework', 'mobility']
  const rows = clients.map((c) => ({
    id: c.id,
    name: c.name,
    age: c.age,
    address: c.address,
    conditions: Array.isArray(c.conditions) ? c.conditions.join('; ') : c.conditions,
    allergies: c.allergies || '',
    emergency_contact: c.emergency_contact || c.emergencyContact || '',
    support_framework: c.support_framework || c.supportFramework || '',
    mobility: c.mobility || '',
  }))
  downloadCsv(`carei-clients-${new Date().toISOString().split('T')[0]}.csv`, headers, rows)
}
