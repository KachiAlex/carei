import { getToken, setToken, getRefreshToken, setRefreshToken, clearAuthCache } from '../utils/tokenCache'
import { secureSet, secureGet, secureRemove } from '../utils/secureStorage'

function getApiBase(): string {
  // 1. Environment override always wins
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL

  // 2. Capacitor native app → absolute URL (runs on capacitor://localhost)
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('capacitor')) {
    return 'https://www.careiapp.com/api'
  }

  // 3. Production web (deployed on Vercel) → relative path
  //    Works on both carei-app.vercel.app and careiapp.com custom domain
  if (!import.meta.env.DEV) {
    return '/api'
  }

  // 4. Local dev → relative path (proxied by Vite dev server)
  return '/api'
}

export const API_BASE = getApiBase()
const jsonHeaders = { 'Content-Type': 'application/json' }

async function handleAuthError(status: number): Promise<boolean> {
  if (status === 401) {
    // Try to refresh the access token using the refresh token
    const refreshed = await tryRefreshToken()
    if (refreshed) return true // caller should retry

    // Refresh failed — clear everything and redirect to login
    clearAuthCache()
    await secureRemove('token')
    await secureRemove('refreshToken')
    await secureRemove('user')
    localStorage.removeItem('carei_current_tenant')
    localStorage.removeItem('carei_biometric_enabled')
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/join')) {
      window.location.href = '/login'
    }
  }
  return false
}

let _refreshing: Promise<boolean> | null = null

async function tryRefreshToken(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (_refreshing) return _refreshing
  _refreshing = doRefresh()
  try { return await _refreshing } finally { _refreshing = null }
}

async function doRefresh(): Promise<boolean> {
  let refreshToken = getRefreshToken()
  if (!refreshToken) {
    refreshToken = await secureGet('refreshToken')
    if (refreshToken) setRefreshToken(refreshToken)
  }
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { ...jsonHeaders },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data.token && data.refreshToken) {
      setToken(data.token)
      setRefreshToken(data.refreshToken)
      await secureSet('token', data.token)
      await secureSet('refreshToken', data.refreshToken)
      if (data.user) {
        const userJson = JSON.stringify(data.user)
        await secureSet('user', userJson)
      }
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function refreshSession(): Promise<boolean> {
  return tryRefreshToken()
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  const tenant = localStorage.getItem('carei_current_tenant')
  const headers: Record<string, string> = {}

  if (token) headers.Authorization = `Bearer ${token}`

  let slug = ''
  if (tenant) {
    try {
      const parsed = JSON.parse(tenant)
      if (parsed.slug) slug = parsed.slug
    } catch { /* ignore */ }
  }

  // Fallback: extract tenant slug from URL path /tenant/:slug/...
  if (!slug && typeof window !== 'undefined') {
    const match = window.location.pathname.match(/\/tenant\/([^\/]+)/)
    if (match) slug = match[1]
  }

  if (slug) headers['X-Tenant-Slug'] = slug

  return headers
}

async function postWithRetry(path: string, body: unknown, retries = 3, extraHeaders?: Record<string, string>): Promise<any> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { ...jsonHeaders, ...authHeaders(), ...extraHeaders },
        body: JSON.stringify(body),
      })
      
      if (!res.ok) {
        if (res.status === 401) {
          const refreshed = await handleAuthError(res.status)
          if (refreshed && attempt < retries - 1) continue // retry with new token
        }
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

export async function post(path: string, body: unknown, extraHeaders?: Record<string, string>) {
  return postWithRetry(path, body, 3, extraHeaders)
}

async function getWithRetry(path: string, retries = 3, extraHeaders?: Record<string, string>): Promise<any> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { ...authHeaders(), ...extraHeaders },
      })

      if (!res.ok) {
        if (res.status === 401) {
          const refreshed = await handleAuthError(res.status)
          if (refreshed && attempt < retries - 1) continue // retry with new token
        }
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

export async function get(path: string, extraHeaders?: Record<string, string>) {
  return getWithRetry(path, 3, extraHeaders)
}

async function putWithRetry(path: string, body: unknown, retries = 3, extraHeaders?: Record<string, string>): Promise<any> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'PUT',
        headers: { ...jsonHeaders, ...authHeaders(), ...extraHeaders },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        if (res.status === 401) {
          const refreshed = await handleAuthError(res.status)
          if (refreshed && attempt < retries - 1) continue
        }
        handleAuthError(res.status)
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return await res.json()
    } catch (err) {
      lastError = err as Error
      if (err instanceof Error && err.message.includes('HTTP 4')) throw err
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }
  throw lastError || new Error('Network error after retries')
}

export async function put(path: string, body: unknown, extraHeaders?: Record<string, string>) {
  return putWithRetry(path, body, 3, extraHeaders)
}

async function patchWithRetry(path: string, body?: unknown, retries = 3, extraHeaders?: Record<string, string>): Promise<any> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const opts: RequestInit = {
        method: 'PATCH',
        headers: { ...jsonHeaders, ...authHeaders(), ...extraHeaders },
      }
      if (body !== undefined) opts.body = JSON.stringify(body)
      const res = await fetch(`${API_BASE}${path}`, opts)
      if (!res.ok) {
        if (res.status === 401) {
          const refreshed = await handleAuthError(res.status)
          if (refreshed && attempt < retries - 1) continue
        }
        handleAuthError(res.status)
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return await res.json()
    } catch (err) {
      lastError = err as Error
      if (err instanceof Error && err.message.includes('HTTP 4')) throw err
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }
  throw lastError || new Error('Network error after retries')
}

async function delWithRetry(path: string, retries = 3, extraHeaders?: Record<string, string>): Promise<any> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'DELETE',
        headers: { ...authHeaders(), ...extraHeaders },
      })
      if (!res.ok) {
        if (res.status === 401) {
          const refreshed = await handleAuthError(res.status)
          if (refreshed && attempt < retries - 1) continue
        }
        handleAuthError(res.status)
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return await res.json()
    } catch (err) {
      lastError = err as Error
      if (err instanceof Error && err.message.includes('HTTP 4')) throw err
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }
  throw lastError || new Error('Network error after retries')
}

export async function del(path: string, extraHeaders?: Record<string, string>) {
  return delWithRetry(path, 3, extraHeaders)
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
  return patchWithRetry(`/clients?id=${encodeURIComponent(clientId)}`, data)
}

export async function deleteClient(clientId: string) {
  return delWithRetry(`/clients?id=${encodeURIComponent(clientId)}`)
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
  return patchWithRetry(`/schedule?id=${encodeURIComponent(visitId)}`, data)
}

export async function deleteScheduledVisit(visitId: string) {
  return delWithRetry(`/schedule?id=${encodeURIComponent(visitId)}`)
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
  if (res.token) {
    setToken(res.token)
    await secureSet('token', res.token)
  }
  return res
}

export async function loginUser(data: { email: string; pin: string }) {
  const res = await post('/auth/login', data) as any
  if (res.token) {
    setToken(res.token)
    await secureSet('token', res.token)
  }
  if (res.refreshToken) {
    setRefreshToken(res.refreshToken)
    await secureSet('refreshToken', res.refreshToken)
  }
  return res
}

export async function loginWithPassword(data: { email: string; password: string }) {
  const res = await post('/auth/login-password', data) as any
  if (res.token) {
    setToken(res.token)
    await secureSet('token', res.token)
  }
  if (res.refreshToken) {
    setRefreshToken(res.refreshToken)
    await secureSet('refreshToken', res.refreshToken)
  }
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
  clearAuthCache()
  await secureRemove('token')
  await secureRemove('refreshToken')
  await secureRemove('user')
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

export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  return post('/auth/change-password', data)
}

export async function updateProfile(data: { name?: string; phone?: string; region?: string }) {
  return patchWithRetry('/auth/update-profile', data)
}

export async function biometricLogin(data: { email: string; credentialId: string }) {
  const res = await post('/auth/biometric-login', data) as any
  if (res.token) {
    setToken(res.token)
    await secureSet('token', res.token)
  }
  return res
}

export async function biometricTokenLogin(data: { email: string; token: string }) {
  const res = await post('/auth/biometric-token-login', data) as any
  if (res.token) {
    setToken(res.token)
    await secureSet('token', res.token)
  }
  if (res.refreshToken) {
    setRefreshToken(res.refreshToken)
    await secureSet('refreshToken', res.refreshToken)
  }
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
  return patchWithRetry(`/manager/caregiver?id=${caregiverId}`, { status })
}

export async function deleteCaregiver(caregiverId: string) {
  return delWithRetry(`/manager/caregiver?id=${caregiverId}`)
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
  return patchWithRetry(`/manager/assignments?id=${assignmentId}`, data)
}

export async function deleteAssignment(caregiverId: string, clientId: string) {
  return delWithRetry(`/manager/assignments?caregiverId=${caregiverId}&clientId=${clientId}`)
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
  return delWithRetry(`/manager/tasks?id=${taskId}`)
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
  status: 'given' | 'skipped' | 'refused' | 'delayed'
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

export async function uploadFile(fileData: string, fileName: string, folder: string): Promise<string> {
  const res = await post('/upload', { fileData, fileName, folder }) as any
  return res.url
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
  return delWithRetry(`/visit-draft?visitId=${encodeURIComponent(visitId)}`)
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
  return delWithRetry(`/body-map?markId=${markId}`)
}

export async function getAgencies() {
  return get('/agencies')
}

export async function getAgency(id: string) {
  return get(`/agencies?id=${id}`)
}

export async function getVisitApprovals(status?: string) {
  const qs = status ? `?status=${status}` : ''
  return get(`/visit-approvals${qs}`)
}

export async function getFamilyVisits(clientId: string) {
  return get(`/family-visits?clientId=${clientId}`)
}

export function exportAuditLogsUrl(params: { from?: string; to?: string; action?: string }) {
  const qs = new URLSearchParams()
  qs.append('format', 'csv')
  if (params.from) qs.append('from', params.from)
  if (params.to) qs.append('to', params.to)
  if (params.action) qs.append('action', params.action)
  return `/api/audit-logs?${qs.toString()}`
}

export async function getAuditLogs(params: { from?: string; to?: string; action?: string; limit?: number } = {}) {
  const qs = new URLSearchParams()
  qs.append('format', 'json')
  if (params.from) qs.append('from', params.from)
  if (params.to) qs.append('to', params.to)
  if (params.action) qs.append('action', params.action)
  if (params.limit) qs.append('limit', String(params.limit))
  return get(`/audit-logs?${qs.toString()}`)
}

export async function updateVisitApproval(data: {
  visitId: string
  approvalStatus?: string
  familyRead?: boolean
}) {
  return post('/visit-approvals', data)
}

export function exportAgencyDataUrl(): string {
  return `/api/data-export`
}

export async function deleteAgencyData(confirmText: string) {
  return post('/data-delete', { confirmText })
}

export async function sendOtp(data: { email: string; purpose?: string }) {
  return post('/otp', { action: 'send', ...data })
}

export async function verifyOtp(data: { email: string; code: string; purpose?: string; userData?: any }) {
  return post('/otp', { action: 'verify', ...data })
}

// Family Authentication API
export async function familyLogin(data: { email: string; pin: string }) {
  const res = await post('/family/auth/login', data) as any
  if (res.token) {
    setToken(res.token)
    localStorage.setItem('familyToken', res.token)
    localStorage.setItem('familyRefreshToken', res.refreshToken)
    localStorage.setItem('familyMember', JSON.stringify(res.familyMember))
  }
  return res
}

export async function familyRegister(data: {
  name: string
  email: string
  phoneNumber?: string
  relationship: string
  clientId: string
  invitedBy: string
  role: 'primary' | 'secondary' | 'limited'
}) {
  return post('/family/auth/register', data)
}

export async function familyLogout() {
  try {
    await post('/family/auth/logout', {})
  } finally {
    localStorage.removeItem('familyToken')
    localStorage.removeItem('familyRefreshToken')
    localStorage.removeItem('familyMember')
  }
}

export async function refreshFamilyToken(refreshToken: string) {
  const res = await post('/family/auth/refresh', { refreshToken }) as any
  if (res.token) {
    localStorage.setItem('familyToken', res.token)
    localStorage.setItem('familyRefreshToken', res.refreshToken)
  }
  return res
}

export async function sendFamilyPasswordReset(email: string) {
  return post('/family/auth/forgot-password', { email })
}

export async function resetFamilyPassword(data: { token: string; pin: string }) {
  return post('/family/auth/reset-password', data)
}

// Family Dashboard API
export async function getFamilyDashboard() {
  return get('/family/dashboard')
}

export async function getFamilyClientDetails(clientId: string) {
  return get(`/family/clients/${clientId}`)
}

// Family Member Management
export async function getFamilyMembers(clientId: string) {
  return get(`/family/members?clientId=${clientId}`)
}

export async function inviteFamilyMember(data: {
  name: string
  email: string
  relationship: string
  role: 'primary' | 'secondary' | 'limited'
  clientId: string
}) {
  return post('/family/members/invite', data)
}

export async function updateFamilyMember(memberId: string, updates: any) {
  return put(`/family/members/${memberId}`, updates)
}

export async function removeFamilyMember(memberId: string) {
  return del(`/family/members/${memberId}`)
}

// Family Tasks
export async function getFamilyTasks(clientId: string) {
  return get(`/family/clients/${clientId}/tasks`)
}

export async function updateFamilyTask(clientId: string, taskId: string, updates: {
  completed?: boolean
  notes?: string
}) {
  return put(`/family/clients/${clientId}/tasks/${taskId}`, updates)
}

// Family Messages
export async function getFamilyMessages(clientId: string) {
  return get(`/family/clients/${clientId}/messages`)
}

export async function sendFamilyMessage(clientId: string, message: string) {
  return post(`/family/clients/${clientId}/messages`, { message })
}

// Family Notifications
export async function getFamilyNotifications() {
  return get('/family/notifications')
}

export async function markNotificationRead(notificationId: string) {
  return put(`/family/notifications/${notificationId}/read`, {})
}

export async function markAllNotificationsRead() {
  return put('/family/notifications/read-all', {})
}

// Family Visits
export async function getFamilyVisitsEnhanced(clientId: string) {
  return get(`/family/clients/${clientId}/visits`)
}

export async function createTenant(data: {
  slug: string
  name: string
  domain?: string
  plan?: string
  manager?: { name: string; email: string; phone?: string; region?: string; pin?: string; role?: string }
}) {
  return post('/tenants', data)
}

export async function getTenantMembers(slug: string) {
  return get(`/tenants?members=${encodeURIComponent(slug)}`)
}

export async function getTenantStatsApi(slug: string) {
  return get(`/tenants?stats=${encodeURIComponent(slug)}`)
}

export async function updateTenant(slug: string, data: { name?: string; settings?: Record<string, unknown> }) {
  return putWithRetry(`/tenants?slug=${encodeURIComponent(slug)}`, data)
}

export async function updateTenantPlan(slug: string, plan: string) {
  return patchWithRetry(`/tenants?slug=${encodeURIComponent(slug)}&action=plan`, { plan })
}

export async function updateTenantActive(slug: string, active: boolean) {
  return patchWithRetry(`/tenants?slug=${encodeURIComponent(slug)}&action=active`, { active })
}

export async function updateTenantPrice(slug: string, pricePerCarer: number, billingModel?: string) {
  return patchWithRetry(`/tenants?slug=${encodeURIComponent(slug)}&action=price`, { pricePerCarer, ...(billingModel ? { billingModel } : {}) })
}

export async function deleteTenant(slug: string) {
  return delWithRetry(`/tenants?slug=${encodeURIComponent(slug)}`)
}

export async function getUserType(email: string) {
  const res = await fetch(`${API_BASE}/user-type?email=${encodeURIComponent(email)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getAllTenantsAdmin() {
  return get('/tenants?admin=true')
}

// ─── Care Plans ───

export interface CarePlanData {
  objectives?: string[]
  preventive?: string[]
  risks?: string[]
  postMed?: string[]
  lastReview?: string[]
  pbsTriggers?: string[]
  safetyPlan?: string[]
  pbsCalmSigns?: string[]
  pbsCalmActions?: string[]
  pbsAnxiousSigns?: string[]
  pbsAnxiousActions?: string[]
  pbsRiskSigns?: string[]
  pbsRiskActions?: string[]
}

export async function getCarePlan(clientId: string) {
  return get(`/care-plans?clientId=${encodeURIComponent(clientId)}`)
}

export async function createCarePlan(data: { clientId: string } & CarePlanData) {
  return post('/care-plans', data)
}

export async function updateCarePlan(planId: string, data: CarePlanData) {
  return putWithRetry(`/care-plans?id=${encodeURIComponent(planId)}`, data)
}

export async function publishCarePlan(planId: string) {
  return patchWithRetry(`/care-plans?id=${encodeURIComponent(planId)}&action=publish`)
}

export async function archiveCarePlan(planId: string) {
  return patchWithRetry(`/care-plans?id=${encodeURIComponent(planId)}&action=archive`)
}
