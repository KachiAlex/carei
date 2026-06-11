const API_BASE = import.meta.env.VITE_API_URL || '/api'
const jsonHeaders = { 'Content-Type': 'application/json' }

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('carei_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

async function get(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function chatWithAI(message: string, context?: string) {
  return post('/anthropic/chat', { message, context })
}

export async function summarizeTranscript(transcript: string) {
  return post('/anthropic/summary', { transcript })
}

export async function sendSOS(payload: { visitId: string; location?: string; timestamp: string }) {
  return post('/sos', payload)
}

export async function saveVisit(visitId: string, data: unknown) {
  return post(`/visit/${visitId}`, data)
}

export async function getManagerData() {
  return get('/manager/data')
}

export async function getVisits() {
  return get('/visits')
}

export async function fetchVisit(visitId: string) {
  return get(`/visit/${visitId}`)
}

export async function initDatabase() {
  return post('/init-db', {})
}

export async function getClients() {
  return get('/clients')
}

export async function getCarers() {
  return get('/carers')
}

export async function fetchClient(clientId: string) {
  return get(`/clients/${clientId}`)
}

export async function createClient(data: {
  id: string
  name: string
  age?: number
  address?: string
  conditions?: string[]
  medications?: { name: string; dose: string; frequency: string }[]
  preferences?: string
  emergencyContact?: string
}) {
  return post('/clients', data)
}

export async function updateClient(clientId: string, data: Partial<{
  name: string
  age: number
  address: string
  conditions: string[]
  medications: { name: string; dose: string; frequency: string }[]
  preferences: string
  emergencyContact: string
}>) {
  const res = await fetch(`${API_BASE}/clients/${clientId}`, {
    method: 'PATCH',
    headers: { ...jsonHeaders, ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteClient(clientId: string) {
  const res = await fetch(`${API_BASE}/clients/${clientId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getScheduledVisits(from?: string, to?: string) {
  const qs = from && to ? `?from=${from}&to=${to}` : ''
  return get(`/schedule${qs}`)
}

export async function createScheduledVisit(data: {
  id: string
  clientId?: string
  clientName: string
  carerId?: string
  carerName?: string
  time?: string
  duration?: string
  tasks?: string[]
  flags?: string[]
  recurring?: string
  visitDate: string
}) {
  return post('/schedule', data)
}

export async function updateScheduledVisit(visitId: string, data: Partial<{
  clientId: string
  clientName: string
  carerId: string
  carerName: string
  time: string
  duration: string
  status: string
  tasks: string[]
  flags: string[]
  recurring: string
  visitDate: string
}>) {
  const res = await fetch(`${API_BASE}/schedule/${visitId}`, {
    method: 'PATCH',
    headers: { ...jsonHeaders, ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteScheduledVisit(visitId: string) {
  const res = await fetch(`${API_BASE}/schedule/${visitId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function registerUser(data: {
  id: string
  name: string
  email: string
  phone: string
  region: string
  pin: string
  role?: string
}) {
  const res = await post('/auth/register', data) as any
  if (res.token) localStorage.setItem('carei_token', res.token)
  return res
}

export async function loginUser(data: { email: string; pin: string }) {
  const res = await post('/auth/login', data) as any
  if (res.token) localStorage.setItem('carei_token', res.token)
  return res
}

export async function logoutUser() {
  localStorage.removeItem('carei_token')
  return post('/auth/logout', {})
}

export async function getMe() {
  return get('/auth/me')
}

export async function getBiometricsStatus() {
  return get('/auth/biometrics')
}

export async function updateBiometrics(data: { credential?: unknown; enabled: boolean }) {
  return post('/auth/biometrics', data)
}

export async function biometricLogin(data: { email: string; credentialId: string }) {
  const res = await post('/auth/biometric-login', data) as any
  if (res.token) localStorage.setItem('carei_token', res.token)
  return res
}

export async function createCaregiver(data: {
  name: string
  email: string
  phone: string
  region: string
  pin: string
  role?: string
}) {
  return post('/manager/caregivers', data)
}

export async function fetchCaregiver(caregiverId: string) {
  return get(`/manager/caregiver?id=${caregiverId}`)
}

export async function updateCaregiverStatus(caregiverId: string, status: string) {
  const res = await fetch(`${API_BASE}/manager/caregiver?id=${caregiverId}`, {
    method: 'PATCH',
    headers: { ...jsonHeaders, ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteCaregiver(caregiverId: string) {
  const res = await fetch(`${API_BASE}/manager/caregiver?id=${caregiverId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getAssignments() {
  return get('/manager/assignments')
}

export async function createAssignment(data: {
  caregiverId: string
  clientId: string
  visitDate?: string
  visitTime?: string
  instructions?: string
}) {
  return post('/manager/assignments', data)
}

export async function updateAssignment(assignmentId: string, data: {
  visitDate?: string
  visitTime?: string
  instructions?: string
}) {
  const res = await fetch(`${API_BASE}/manager/assignments?id=${assignmentId}`, {
    method: 'PATCH',
    headers: { ...jsonHeaders, ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteAssignment(caregiverId: string, clientId: string) {
  const res = await fetch(`${API_BASE}/manager/assignments?caregiverId=${caregiverId}&clientId=${clientId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getManagerTasks(clientId?: string) {
  const qs = clientId ? `?clientId=${clientId}` : ''
  return get(`/manager/tasks${qs}`)
}

export async function getCaregiverTasks(clientId?: string) {
  const qs = clientId ? `?clientId=${clientId}` : ''
  return get(`/caregiver/tasks${qs}`)
}

export async function createManagerTask(data: {
  clientId: string
  name: string
  description?: string
  frequency?: string
}) {
  return post('/manager/tasks', data)
}

export async function deleteManagerTask(taskId: string) {
  const res = await fetch(`${API_BASE}/manager/tasks?id=${taskId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getCaregiverClients() {
  return get('/caregiver/clients')
}

export async function getClient(clientId: string) {
  return get(`/clients/${clientId}`)
}

export async function startTask(data: { clientId: string; taskName: string }) {
  return post('/tasks/start', data)
}

export async function completeTask(data: { logId: string; notes?: string }) {
  return post('/tasks/complete', data)
}

export async function addTaskLog(data: { clientId: string; taskName: string; notes?: string }) {
  return post('/tasks/log', data)
}

export async function getClientLogs(clientId: string) {
  return get(`/tasks/log?clientId=${clientId}`)
}

export async function logMedication(data: {
  clientId: string
  visitId?: string
  medicationName: string
  dose?: string
  status: 'given' | 'skipped' | 'refused'
  witnessName?: string
  reason?: string
  notes?: string
  administeredAt?: string
}) {
  return post('/medication-log', data)
}

export async function getMedicationLogs(clientId: string, today?: boolean) {
  const qs = today ? `?clientId=${clientId}&today=1` : `?clientId=${clientId}`
  return get(`/medication-log${qs}`)
}

export async function getDrugInteractions(drugs: string[]) {
  return get(`/drug-interactions?drugs=${encodeURIComponent(drugs.join(','))}`)
}

export async function reportIncident(data: {
  visitId?: string
  clientId?: string
  clientName?: string
  type: string
  description?: string
  severity: 'low' | 'medium' | 'high'
}) {
  return post('/incidents', data)
}

export async function getIncidents(visitId?: string) {
  const qs = visitId ? `?visitId=${visitId}` : ''
  return get(`/incidents${qs}`)
}

export async function saveVoiceMemo(data: {
  visitId?: string
  clientId?: string
  audioUrl: string
  duration: number
}) {
  return post('/voice-memos', data)
}

export async function getVoiceMemos(visitId?: string) {
  const qs = visitId ? `?visitId=${visitId}` : ''
  return get(`/voice-memos${qs}`)
}

export async function saveVisitDraft(visitId: string, data: unknown) {
  return post(`/visit/${visitId}/draft`, data)
}

export async function getVisitDraft(visitId: string) {
  return get(`/visit/${visitId}/draft`)
}

export async function deleteVisitDraft(visitId: string) {
  const res = await fetch(`${API_BASE}/visit/${visitId}/draft`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
