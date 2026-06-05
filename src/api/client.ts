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
