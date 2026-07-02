import { post, get, put, del } from './client'

// Family Authentication Types
export interface FamilyMember {
  id: string
  name: string
  email: string
  role: 'primary' | 'secondary' | 'limited'
  clientId: string
  relationship: string
  permissions: string[]
  phoneNumber?: string
  isActive: boolean
  createdAt: string
  lastLogin?: string
  invitedBy?: string
}

export interface FamilyLoginRequest {
  email: string
  pin: string
}

export interface FamilyLoginResponse {
  familyMember: FamilyMember
  token: string
  refreshToken: string
  expiresAt: string
}

export interface FamilyRegistrationRequest {
  name: string
  email: string
  phoneNumber?: string
  relationship: string
  clientId: string
  invitedBy: string
  role: 'primary' | 'secondary' | 'limited'
}

export interface FamilyDashboard {
  familyMember: FamilyMember
  clients: Array<{
    id: string
    name: string
    age?: number
    condition?: string
    lastVisit?: string
    nextVisit?: string
    unreadMessages: number
    pendingTasks: number
    moodStatus?: 'good' | 'fair' | 'concerning'
  }>
  notifications: Array<{
    id: string
    type: 'message' | 'visit' | 'task' | 'emergency'
    title: string
    message: string
    timestamp: string
    read: boolean
    clientId?: string
  }>
  recentActivity: Array<{
    id: string
    type: 'visit_completed' | 'message_received' | 'task_updated'
    description: string
    timestamp: string
    clientId: string
    clientName: string
  }>
}

export interface FamilyClientDetails {
  id: string
  name: string
  age?: number
  condition?: string
  carePlan: {
    objectives: string[]
    preventive: string[]
    risks: string[]
  }
  tasks: Array<{
    id: string
    text: string
    category: string
    completed: boolean
    dueDate?: string
    assignedTo?: string
  }>
  visits: Array<{
    id: string
    date: string
    duration: number
    carerName: string
    mood?: string
    nutritionNote?: string
    summary: string
    status: 'completed' | 'scheduled' | 'cancelled'
  }>
  messages: Array<{
    id: string
    senderName: string
    senderRole: string
    message: string
    timestamp: string
    isFromFamily: boolean
  }>
}

// Family Authentication API
export async function familyLogin(credentials: FamilyLoginRequest): Promise<FamilyLoginResponse> {
  const response = await post('/family/auth/login', credentials) as any
  if (response.token) {
    localStorage.setItem('familyToken', response.token)
    localStorage.setItem('familyRefreshToken', response.refreshToken)
    localStorage.setItem('familyMember', JSON.stringify(response.familyMember))
  }
  return response
}

export async function familyRegister(data: FamilyRegistrationRequest): Promise<FamilyMember> {
  return post('/family/auth/register', data) as any
}

export async function familyLogout(): Promise<void> {
  try {
    await post('/family/auth/logout', {})
  } finally {
    localStorage.removeItem('familyToken')
    localStorage.removeItem('familyRefreshToken')
    localStorage.removeItem('familyMember')
  }
}

export async function refreshFamilyToken(): Promise<string> {
  const refreshToken = localStorage.getItem('familyRefreshToken')
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }
  
  const response = await post('/family/auth/refresh', { refreshToken }) as any
  if (response.token) {
    localStorage.setItem('familyToken', response.token)
    localStorage.setItem('familyRefreshToken', response.refreshToken)
  }
  return response.token
}

export async function sendFamilyPasswordReset(email: string): Promise<void> {
  await post('/family/auth/forgot-password', { email })
}

export async function resetFamilyPassword(token: string, pin: string): Promise<void> {
  await post('/family/auth/reset-password', { token, pin })
}

// Family Dashboard API
export async function getFamilyDashboard(): Promise<FamilyDashboard> {
  return get('/family/dashboard') as any
}

export async function getFamilyClientDetails(clientId: string): Promise<FamilyClientDetails> {
  return get(`/family/clients/${clientId}`) as any
}

// Family Member Management
export async function getFamilyMembers(clientId: string): Promise<FamilyMember[]> {
  return get(`/family/members?clientId=${clientId}`) as any
}

export async function inviteFamilyMember(data: {
  name: string
  email: string
  relationship: string
  role: 'primary' | 'secondary' | 'limited'
  clientId: string
}): Promise<FamilyMember> {
  return post('/family/members/invite', data) as any
}

export async function updateFamilyMember(memberId: string, updates: Partial<FamilyMember>): Promise<FamilyMember> {
  return put(`/family/members/${memberId}`, updates) as any
}

export async function removeFamilyMember(memberId: string): Promise<void> {
  await del(`/family/members/${memberId}`)
}

// Family Tasks
export async function getFamilyTasks(clientId: string): Promise<Array<{
  id: string
  text: string
  category: string
  completed: boolean
  dueDate?: string
  assignedTo?: string
}>> {
  return get(`/family/clients/${clientId}/tasks`) as any
}

export async function updateFamilyTask(clientId: string, taskId: string, updates: {
  completed?: boolean
  notes?: string
}): Promise<void> {
  await put(`/family/clients/${clientId}/tasks/${taskId}`, updates)
}

// Family Messages
export async function getFamilyMessages(clientId: string): Promise<Array<{
  id: string
  senderName: string
  senderRole: string
  message: string
  timestamp: string
  isFromFamily: boolean
}>> {
  return get(`/family/clients/${clientId}/messages`) as any
}

export async function sendFamilyMessage(clientId: string, message: string): Promise<void> {
  await post(`/family/clients/${clientId}/messages`, { message })
}

// Family Notifications
export async function getFamilyNotifications(): Promise<Array<{
  id: string
  type: 'message' | 'visit' | 'task' | 'emergency'
  title: string
  message: string
  timestamp: string
  read: boolean
  clientId?: string
}>> {
  return get('/family/notifications') as any
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await put(`/family/notifications/${notificationId}/read`, {})
}

export async function markAllNotificationsRead(): Promise<void> {
  await put('/family/notifications/read-all', {})
}

// Family Visits
export async function getFamilyVisits(clientId: string): Promise<Array<{
  id: string
  date: string
  duration: number
  carerName: string
  mood?: string
  nutritionNote?: string
  summary: string
  status: 'completed' | 'scheduled' | 'cancelled'
}>> {
  return get(`/family/clients/${clientId}/visits`) as any
}

// Utility Functions
export function getFamilyAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('familyToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getCurrentFamilyMember(): FamilyMember | null {
  const member = localStorage.getItem('familyMember')
  return member ? JSON.parse(member) : null
}

export function isFamilyAuthenticated(): boolean {
  return !!localStorage.getItem('familyToken')
}

// Permission checking
export const FAMILY_PERMISSIONS = {
  // Basic Access (All Family Members)
  VIEW_BASIC_INFO: 'view_basic_info',
  VIEW_VISIT_SUMMARY: 'visit_summary',
  SEND_MESSAGES: 'send_messages',
  
  // Enhanced Access (Primary/Secondary)
  VIEW_CARE_TASKS: 'view_care_tasks',
  VIEW_SCHEDULE: 'view_schedule',
  RECEIVE_NOTIFICATIONS: 'receive_notifications',
  VIEW_CARE_PLAN: 'view_care_plan',
  
  // Full Access (Primary Only)
  MANAGE_FAMILY_MEMBERS: 'manage_family_members',
  APPROVE_VISIT_CHANGES: 'approve_changes',
  VIEW_DETAILED_REPORTS: 'detailed_reports',
  EMERGENCY_CONTACTS: 'emergency_contacts'
}

export function hasPermission(familyMember: FamilyMember, permission: string): boolean {
  return familyMember.permissions.includes(permission)
}

export function canManageFamilyMembers(familyMember: FamilyMember): boolean {
  return familyMember.role === 'primary' && hasPermission(familyMember, FAMILY_PERMISSIONS.MANAGE_FAMILY_MEMBERS)
}

export function canViewCarePlan(familyMember: FamilyMember): boolean {
  return (familyMember.role === 'primary' || familyMember.role === 'secondary') && 
         hasPermission(familyMember, FAMILY_PERMISSIONS.VIEW_CARE_PLAN)
}

export function getDefaultPermissions(role: 'primary' | 'secondary' | 'limited'): string[] {
  switch (role) {
    case 'primary':
      return Object.values(FAMILY_PERMISSIONS)
    case 'secondary':
      return [
        FAMILY_PERMISSIONS.VIEW_BASIC_INFO,
        FAMILY_PERMISSIONS.VIEW_VISIT_SUMMARY,
        FAMILY_PERMISSIONS.SEND_MESSAGES,
        FAMILY_PERMISSIONS.VIEW_CARE_TASKS,
        FAMILY_PERMISSIONS.VIEW_SCHEDULE,
        FAMILY_PERMISSIONS.RECEIVE_NOTIFICATIONS,
        FAMILY_PERMISSIONS.VIEW_CARE_PLAN
      ]
    case 'limited':
      return [
        FAMILY_PERMISSIONS.VIEW_BASIC_INFO,
        FAMILY_PERMISSIONS.VIEW_VISIT_SUMMARY,
        FAMILY_PERMISSIONS.SEND_MESSAGES
      ]
    default:
      return []
  }
}
