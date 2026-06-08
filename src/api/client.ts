const API_BASE = import.meta.env.VITE_API_URL || '/api'
const jsonHeaders = { 'Content-Type': 'application/json' }

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: jsonHeaders,
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
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
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
    headers: jsonHeaders,
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
    headers: jsonHeaders,
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
  return post('/auth/register', data)
}

export async function loginUser(data: { email: string; pin: string }) {
  return post('/auth/login', data)
}

export async function logoutUser() {
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
  return post('/auth/biometric-login', data)
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
    headers: jsonHeaders,
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

export async function deleteAssignment(caregiverId: string, clientId: string) {
  const res = await fetch(`${API_BASE}/manager/assignments?caregiverId=${caregiverId}&clientId=${clientId}`, {
    method: 'DELETE',
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

export async function saveVisitDraft(visitId: string, data: unknown) {
  return post(`/visit/${visitId}/draft`, data)
}

export async function getVisitDraft(visitId: string) {
  return get(`/visit/${visitId}/draft`)
}

export async function deleteVisitDraft(visitId: string) {
  const res = await fetch(`${API_BASE}/visit/${visitId}/draft`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
