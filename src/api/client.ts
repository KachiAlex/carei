function getApiBase(): string {
  // Priority: 1. Environment variable, 2. Local dev, 3. Production
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  
  // Capacitor / native webview uses file:// or capacitor:// protocol
  const isNative = typeof (window as any).Capacitor !== 'undefined' ||
    !['http:', 'https:'].includes(window.location.protocol)
  
  if (isNative) {
    // Use production API for native apps
    return 'https://carei-app.vercel.app/api'
  }
  
  // For web: use relative path (same origin) in production, or localhost in dev
  return '/api'
}

const API_BASE = getApiBase()
const jsonHeaders = { 'Content-Type': 'application/json' }

function handleAuthError(status: number) {
  if (status === 401) {
    localStorage.removeItem('carei_token')
    localStorage.removeItem('carei_user')
    localStorage.removeItem('carei_current_tenant')
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/join')) {
      window.location.href = '/login'
    }
  }
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('carei_token')
  const tenant = localStorage.getItem('carei_current_tenant')
  const headers: Record<string, string> = {}

  if (token) headers.Authorization = `Bearer ${token}`
  if (tenant) {
    try {
      const parsed = JSON.parse(tenant)
      if (parsed.slug) headers['X-Tenant-Slug'] = parsed.slug
    } catch { /* ignore */ }
  }

  return headers
}

async function postWithRetry(path: string, body: unknown, retries = 3): Promise<any> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { ...jsonHeaders, ...authHeaders() },
        body: JSON.stringify(body),
      })
      
      if (!res.ok) {
        handleAuthError(res.status)
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      return await res.json()
    } catch (err) {
      lastError = err as Error

      // Don't retry on 4xx errors (client errors)
      if (err instanceof Error && err.message.includes('HTTP 4')) {
        throw err
      }

      // Exponential backoff: wait longer between retries
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }

  throw lastError || new Error('Network error after retries')
}

async function post(path: string, body: unknown) {
  return postWithRetry(path, body)
}

async function getWithRetry(path: string, retries = 3): Promise<any> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: authHeaders(),
      })

      if (!res.ok) {
        handleAuthError(res.status)
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      return await res.json()
    } catch (err) {
      lastError = err as Error

      // Don't retry on 4xx errors
      if (err instanceof Error && err.message.includes('HTTP 4')) {
        throw err
      }

      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }

  throw lastError || new Error('Network error after retries')
}

async function get(path: string) {
  return getWithRetry(path)
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
  return post(`/visit-detail?id=${encodeURIComponent(visitId)}`, data)
}

export async function startVisit(clientId: string) {
  return post('/visit-start', { clientId })
}

export async function getManagerData() {
  return get('/manager/data')
}

export async function getVisits() {
  return get('/visits')
}

export async function fetchVisit(visitId: string) {
  return get(`/visit-detail?id=${encodeURIComponent(visitId)}`)
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
  return get(`/clients?id=${encodeURIComponent(clientId)}`)
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
  const res = await fetch(`${API_BASE}/clients?id=${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteClient(clientId: string) {
  const res = await fetch(`${API_BASE}/clients?id=${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    handleAuthError(res.status)
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
  const res = await fetch(`${API_BASE}/schedule?id=${encodeURIComponent(visitId)}`, {
    method: 'PATCH',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteScheduledVisit(visitId: string) {
  const res = await fetch(`${API_BASE}/schedule?id=${encodeURIComponent(visitId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    handleAuthError(res.status)
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

export async function loginWithPassword(data: { email: string; password: string }) {
  const res = await post('/auth/login-password', data) as any
  if (res.token) localStorage.setItem('carei_token', res.token)
  return res
}

export async function seedSuperAdmin() {
  return post('/seed-superadmin', {})
}

export async function resetPin(data: { email: string; newPin: string; otp: string }) {
  const res = await post('/auth/reset-pin', data) as any
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
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteCaregiver(caregiverId: string) {
  const res = await fetch(`${API_BASE}/manager/caregiver?id=${caregiverId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    handleAuthError(res.status)
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
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteAssignment(caregiverId: string, clientId: string) {
  const res = await fetch(`${API_BASE}/manager/assignments?caregiverId=${caregiverId}&clientId=${clientId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    handleAuthError(res.status)
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
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getCaregiverClients() {
  return get('/caregiver/clients')
}

export async function getClient(clientId: string) {
  return get(`/clients?id=${encodeURIComponent(clientId)}`)
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
  return post(`/visit-draft?visitId=${encodeURIComponent(visitId)}`, data)
}

export async function getVisitDraft(visitId: string) {
  return get(`/visit-draft?visitId=${encodeURIComponent(visitId)}`)
}

export async function deleteVisitDraft(visitId: string) {
  const res = await fetch(`${API_BASE}/visit-draft?visitId=${encodeURIComponent(visitId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getSchedule() {
  return get('/schedule')
}

export async function saveBodyMapMark(data: {
  visitId: string
  clientId?: string
  x: number
  y: number
  side?: string
  zone?: string
  type?: string
  note?: string
  photoUrl?: string
}) {
  return post('/body-map', data)
}

export async function getBodyMapMarks(visitId?: string, clientId?: string) {
  const qs = visitId ? `?visitId=${visitId}` : clientId ? `?clientId=${clientId}` : ''
  return get(`/body-map${qs}`)
}

export async function deleteBodyMapMark(markId: string) {
  const res = await fetch(`${API_BASE}/body-map?markId=${markId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getAgencies() {
  return get('/agencies')
}

export async function getAgency(id: string) {
  return get(`/agencies?id=${id}`)
}

export async function sendFamilyMessage(data: {
  visitId?: string
  clientId?: string
  message: string
}) {
  return post('/family-messages', data)
}

export async function getFamilyMessages(visitId?: string, clientId?: string) {
  const qs = visitId ? `?visitId=${visitId}` : clientId ? `?clientId=${clientId}` : ''
  return get(`/family-messages${qs}`)
}

export async function getVisitApprovals(status?: string) {
  const qs = status ? `?status=${status}` : ''
  return get(`/visit-approvals${qs}`)
}

export async function updateVisitApproval(data: {
  visitId: string
  approvalStatus?: string
  familyRead?: boolean
}) {
  return post('/visit-approvals', data)
}

export async function sendOtp(data: { email: string; purpose?: string }) {
  return post('/otp', { action: 'send', ...data })
}

export async function verifyOtp(data: { email: string; code: string; purpose?: string; userData?: any }) {
  return post('/otp', { action: 'verify', ...data })
}

export async function getTenantMembers(slug: string) {
  return get(`/tenants?members=${encodeURIComponent(slug)}`)
}

export async function getTenantStatsApi(slug: string) {
  return get(`/tenants?stats=${encodeURIComponent(slug)}`)
}

export async function updateTenant(slug: string, data: { name?: string; settings?: Record<string, unknown> }) {
  const res = await fetch(`${API_BASE}/tenants?slug=${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function updateTenantPlan(slug: string, plan: string) {
  const res = await fetch(`${API_BASE}/tenants?slug=${encodeURIComponent(slug)}&action=plan`, {
    method: 'PATCH',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ plan }),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function updateTenantActive(slug: string, active: boolean) {
  const res = await fetch(`${API_BASE}/tenants?slug=${encodeURIComponent(slug)}&action=active`, {
    method: 'PATCH',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ active }),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteTenant(slug: string) {
  const res = await fetch(`${API_BASE}/tenants?slug=${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getAllTenantsAdmin() {
  return get('/tenants?admin=true')
}
