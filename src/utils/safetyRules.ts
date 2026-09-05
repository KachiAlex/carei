// Bundled offline safety rule set for CAREi
// This file is the source of truth for deterministic safety checks that must work with no signal.
// When online, the app may fetch an updated rule set from the server and cache it locally.

export const SAFETY_RULE_VERSION = '1.0.0'

export interface SafetyRules {
  version: string
  duplicateDoseWindowMinutes: number
  expectedTimeToleranceMinutes: number
  allergyKeywords: string[]
  controlledMedsRequireWitness: boolean
  monitorMeds: string[]
}

// Bundled rules — always present, always offline-capable
export const BUNDLED_RULES: SafetyRules = {
  version: SAFETY_RULE_VERSION,
  duplicateDoseWindowMinutes: 240, // 4 hours
  expectedTimeToleranceMinutes: 120, // 2 hours
  allergyKeywords: ['penicillin', 'amoxicillin', 'aspirin', 'ibuprofen', 'morphine', 'codeine', 'latex', 'nut', 'shellfish', 'gluten', 'dairy', 'egg', 'soy'],
  controlledMedsRequireWitness: true,
  monitorMeds: ['metformin', 'warfarin', 'insulin'],
}

const RULES_CACHE_KEY = 'carei_safety_rules'

export async function getSafetyRules(): Promise<SafetyRules> {
  try {
    const cached = localStorage.getItem(RULES_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as SafetyRules
      if (parsed.version) return parsed
    }
  } catch { /* ignore */ }
  return BUNDLED_RULES
}

export async function cacheSafetyRules(rules: SafetyRules): Promise<void> {
  try {
    localStorage.setItem(RULES_CACHE_KEY, JSON.stringify(rules))
  } catch { /* ignore */ }
}

// ─── Local safety checks (all work offline) ───

export interface AllergyCheckResult {
  hasAllergyInfo: boolean
  matches: string[]
  message: string
}

export function checkAllergy(medicationName: string, clientAllergies: string | null | undefined): AllergyCheckResult {
  if (!clientAllergies || clientAllergies.trim() === '') {
    return {
      hasAllergyInfo: false,
      matches: [],
      message: 'No allergy information recorded for this client.',
    }
  }

  const medLower = medicationName.toLowerCase()
  const allergyLower = clientAllergies.toLowerCase()
  const matches: string[] = []

  // Check if medication name appears in allergy text
  const medTokens = medLower.split(/[\s\-]+/)
  for (const token of medTokens) {
    if (token.length > 2 && allergyLower.includes(token)) {
      matches.push(token)
    }
  }

  // Check known allergy keywords
  for (const keyword of BUNDLED_RULES.allergyKeywords) {
    if (medLower.includes(keyword) && allergyLower.includes(keyword)) {
      if (!matches.includes(keyword)) matches.push(keyword)
    }
  }

  return {
    hasAllergyInfo: true,
    matches,
    message: matches.length > 0
      ? `⚠️ Warning: ${medicationName} may match recorded allergy: ${clientAllergies}`
      : 'No known allergy conflict.',
  }
}

export interface MedOnListCheckResult {
  onList: boolean
  message: string
}

export function checkMedicationOnList(
  medicationName: string,
  clientMedications: Array<{ name: string }> | undefined
): MedOnListCheckResult {
  if (!clientMedications || clientMedications.length === 0) {
    return {
      onList: false,
      message: 'No medications are recorded for this client.',
    }
  }

  const medLower = medicationName.toLowerCase().trim()
  const onList = clientMedications.some((m) => m.name.toLowerCase().trim() === medLower)

  return {
    onList,
    message: onList
      ? `${medicationName} is on the client's current medication list.`
      : `⚠️ ${medicationName} is NOT on the client's current medication list. Please verify before proceeding.`,
  }
}

export interface DuplicateDoseResult {
  isDuplicate: boolean
  message: string
}

export function checkDuplicateDose(
  medicationName: string,
  lastAdministeredAt: string | undefined,
  rules: SafetyRules = BUNDLED_RULES
): DuplicateDoseResult {
  if (!lastAdministeredAt) {
    return { isDuplicate: false, message: '' }
  }

  const last = new Date(lastAdministeredAt).getTime()
  const now = Date.now()
  const windowMs = rules.duplicateDoseWindowMinutes * 60 * 1000

  if (now - last < windowMs) {
    const minsAgo = Math.round((now - last) / 60000)
    return {
      isDuplicate: true,
      message: `⚠️ ${medicationName} was recorded ${minsAgo} minutes ago (within ${rules.duplicateDoseWindowMinutes}-minute window). Possible duplicate dose.`,
    }
  }

  return { isDuplicate: false, message: '' }
}

export interface TimeWindowResult {
  outsideWindow: boolean
  message: string
}

export function checkTimeWindow(
  medicationName: string,
  dueTime: string | undefined,
  rules: SafetyRules = BUNDLED_RULES
): TimeWindowResult {
  if (!dueTime) {
    return { outsideWindow: false, message: '' }
  }

  const [dueH, dueM] = dueTime.split(':').map(Number)
  if (isNaN(dueH) || isNaN(dueM)) {
    return { outsideWindow: false, message: '' }
  }

  const now = new Date()
  const due = new Date()
  due.setHours(dueH, dueM, 0, 0)

  // Handle wrap-around for late-night doses
  let diffMinutes = Math.abs(now.getTime() - due.getTime()) / 60000
  if (diffMinutes > 720) diffMinutes = 1440 - diffMinutes // wrap around midnight

  if (diffMinutes > rules.expectedTimeToleranceMinutes) {
    return {
      outsideWindow: true,
      message: `⚠️ ${medicationName} is due at ${dueTime}. Current time is well outside the expected ${rules.expectedTimeToleranceMinutes}-minute window.`,
    }
  }

  return { outsideWindow: false, message: '' }
}
