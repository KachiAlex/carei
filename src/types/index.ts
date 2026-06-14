// CAREi Type Definitions - Matching CAREi_Features.md specification

// Design System Colors
export const COLORS = {
  navy: '#1B2A49',
  darkNavy: '#0F1D34',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
  g0: '#F8FAFC',
  g1: '#E2E8F0',
  g2: '#94A3B8',
  g3: '#475569',
  g4: '#64748B',
} as const

// User Roles
export type UserRole = 'carer' | 'manager'

// User Account
export interface User {
  id: string
  name: string
  email: string
  agency: string
  role: UserRole
  pin: string
  initials: string
  status: 'active' | 'invited' | 'suspended'
  lastActive?: string
  visits?: number
  dbs?: string
  compliance?: number
}

// Emergency Contact
export interface EmergencyContact {
  name: string
  relation: string
  phone: string
  primary: boolean
}

// Medication
export interface Medication {
  name: string
  dose: string
  dueTime: string
  route?: string
  timeSensitive: boolean
  dosingGapHours: number
  adminNote: string
  interactions: string[]
  possibleDuplicate: boolean
  duplicateNote?: string
  isControlled?: boolean
  status?: 'confirmed' | 'refused' | 'pending'
  administeredAt?: string
  witnessName?: string
  skipReason?: string
}

// Contextual Care Cue
export interface CareCue {
  trigger: string
  content: string
}

// Client
export interface Client {
  id: string
  name: string
  age: number
  address: string
  emoji: string
  time: string
  condition: string
  tags: string[]
  gp: string
  allergy: string
  supportLevel: string
  framework: string
  communication: string
  mobilityNote: string
  medNote?: string
  vitalSignsRequired: boolean
  vitalSignsThreshold: string
  lastHandoverBullets: string[]
  contextualCues: CareCue[]
  meds: Medication[]
  conditions: string[]
  chokingRisk: boolean
  chokingHistory?: string
  dysphagiaProtocol?: string
  bpBaseline: { sys: number; dia: number }
  pronouns: string
  emergencyContacts: EmergencyContact[]
  lastHandover?: string
  lastHandoverAt?: string
  preferences?: string
  careCues?: string[]
  pbsFramework?: PBSFramework
}

// PBS Framework
export interface PBSFramework {
  state: 'green' | 'amber' | 'red'
  calmSigns: string[]
  calmActions: string[]
  anxiousSigns: string[]
  anxiousActions: string[]
  riskSigns: string[]
  riskActions: string[]
}

// Visit
export type VisitStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled'

export interface Visit {
  id: string
  clientId: string
  clientName: string
  time: string
  duration: string
  status: VisitStatus
  tasks: string[]
  flags: string[]
  emoji?: string
  carerId?: string
  carerName?: string
  notes?: string
  confirmedMeds?: string[]
  skippedMeds?: string[]
  fluidMl?: number
  completedTasks?: string[]
  mealStatus?: string
  mood?: string
  visitStartTime?: string
  visitEndTime?: string
  approvalStatus?: 'pending' | 'approved' | 'released'
  hasIncident?: boolean
}

// Incident
export type IncidentSeverity = 'Low' | 'Medium' | 'High'
export type IncidentType = 'Fall' | 'Medication Error' | 'Skin Change' | 'Behaviour' | 'Other'

export interface Incident {
  id: string
  visitId: string
  clientId?: string
  clientName?: string
  type: IncidentType
  severity: IncidentSeverity
  description: string
  timestamp: string
  reportedBy?: string
  status?: 'open' | 'resolved'
}

// Body Map Mark
export type BodyMapCategory = 'Wound' | 'Bruise' | 'Redness' | 'Swelling' | 'Rash' | 'Pressure Area' | 'Skin Integrity' | 'Injury'

export interface BodyMapMark {
  id: string
  zone: string
  type: BodyMapCategory
  color: string
  severity?: 'Mild' | 'Moderate' | 'Severe'
  description?: string
  photoUrl?: string
  createdAt: string
}

// Carer (Team Management)
export interface Carer {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'invited' | 'suspended'
  lastActive: string
  visits: number
  initials: string
  dbs: string
  compliance: number
  currentClient?: string
  shiftTime?: string
  gpsLastSeen?: string
}

// Audit Entry
export interface AuditEntry {
  time: string
  event: string
  carer: string
  status: 'ok' | 'warn' | 'fail'
}

// Alert
export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low'
export type AlertType = 'Lone Worker' | 'AI Flag' | 'Compliance' | 'Schedule'

export interface AgencyAlert {
  id: number
  severity: AlertSeverity
  type: AlertType
  title: string
  detail: string
  time: string
}

// Chat Message (Copilot)
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

// Offline Queue Item
export interface OfflineQueueItem {
  id: string
  type: 'visit' | 'medication-log' | 'incident' | 'body-map' | 'handover'
  payload: unknown
  createdAt: string
  retries: number
}

// Signup Flow Steps
export type SignupStep = 'name' | 'role' | 'pin' | 'done'

// Login Method
export type LoginMethod = 'pin' | 'demo-carer' | 'demo-manager'
