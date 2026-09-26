/**
 * Family-safe summarization — deterministic extraction of shareable facts
 * from a visit record. Nothing outside the whitelisted fact set can reach
 * family members, regardless of what the AI generates.
 *
 * Ported from the CAREi vision prototype (family-safe-summary.ts),
 * adapted to this schema (mood, meal_status, fluid_glasses, tasks).
 */

export const SAFE_MOODS = ['good', 'neutral', 'low', 'anxious', 'tired', 'happy', 'settled'] as const
export const SAFE_MEALS = ['full', 'half', 'refused', 'none', 'eaten', 'partial'] as const

export type SafeFacts = {
  clientFirstName: string
  completedAt: string
  mood?: string
  mealStatus?: string
  fluidGlasses?: number
  taskCount: number
}

export type SafeVisitSource = {
  client_name?: string | null
  clientName?: string | null
  clock_in_at?: string | null
  clock_out_at?: string | null
  mood?: string | null
  meal_status?: string | null
  fluid_glasses?: number | null
  tasks?: unknown
}

function firstName(name: string | null | undefined): string {
  return (name || 'your family member').split(/\s+/)[0]
}

function normalizeMood(mood: string | null | undefined): string | undefined {
  if (!mood) return undefined
  const m = mood.trim().toLowerCase()
  return (SAFE_MOODS as readonly string[]).includes(m) ? m : undefined
}

function normalizeMeal(meal: string | null | undefined): string | undefined {
  if (!meal) return undefined
  const m = meal.trim().toLowerCase()
  return (SAFE_MEALS as readonly string[]).includes(m) ? m : undefined
}

export function extractFamilySafeFacts(visit: SafeVisitSource): SafeFacts {
  const name = visit.client_name || visit.clientName || ''
  const tasks = Array.isArray(visit.tasks) ? visit.tasks : []
  return {
    clientFirstName: firstName(name),
    completedAt: visit.clock_out_at || visit.clock_in_at || new Date().toISOString(),
    ...(normalizeMood(visit.mood) ? { mood: normalizeMood(visit.mood) } : {}),
    ...(normalizeMeal(visit.meal_status) ? { mealStatus: normalizeMeal(visit.meal_status) } : {}),
    ...(typeof visit.fluid_glasses === 'number' && visit.fluid_glasses >= 0 && visit.fluid_glasses <= 50
      ? { fluidGlasses: visit.fluid_glasses }
      : {}),
    taskCount: tasks.length,
  }
}

/**
 * Deterministic family summary rendered purely from safe facts.
 * Used as the offline/no-AI-key fallback and as a grounding check.
 */
export function renderFamilySummary(facts: SafeFacts): string {
  const parts: string[] = []
  const date = new Date(facts.completedAt)
  const timeStr = isNaN(date.getTime())
    ? 'today'
    : date.toLocaleString('en-GB', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })

  parts.push(`${facts.clientFirstName}'s visit was completed on ${timeStr}.`)
  if (facts.mood) parts.push(`${facts.clientFirstName}'s mood was ${facts.mood}.`)
  if (facts.mealStatus === 'full' || facts.mealStatus === 'eaten') parts.push(`${facts.clientFirstName} ate the full meal offered.`)
  else if (facts.mealStatus === 'half' || facts.mealStatus === 'partial') parts.push(`${facts.clientFirstName} ate about half of the meal offered.`)
  else if (facts.mealStatus === 'refused' || facts.mealStatus === 'none') parts.push(`${facts.clientFirstName} did not eat the offered meal.`)
  if (facts.fluidGlasses !== undefined) parts.push(`${facts.clientFirstName} had ${facts.fluidGlasses} glasses of fluid.`)
  if (facts.taskCount > 0) parts.push(`${facts.taskCount} scheduled care task${facts.taskCount === 1 ? ' was' : 's were'} completed.`)

  return parts.join(' ')
}

/**
 * Post-generation safety net: strips content a family update must never
 * contain even if the AI output drifts. Returns cleaned text plus flags.
 */
const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b\d{3,}\s*(mg|mcg|ml|units?)\b/gi, label: 'medication dose' },
  { pattern: /\b(warfarin|metformin|insulin|furosemide|digoxin|amiodarone|lisinopril|simvastatin|tramadol|spironolactone|clarithromycin|fluoxetine|aspirin|ibuprofen)\b/gi, label: 'medication name' },
  { pattern: /\b(DNR|do not resuscitate|safeguarding referral|deprivation of liberty|dols)\b/gi, label: 'sensitive clinical/legal term' },
  { pattern: /\bcarer\s+\w+\s+(said|reported|noted)\b/gi, label: 'carer attribution' },
]

export function sanitizeFamilyText(text: string): { text: string; removed: string[] } {
  let out = text
  const removed: string[] = []
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(out)) {
      removed.push(label)
      out = out.replace(pattern, '[removed]')
    }
  }
  return { text: out.trim(), removed }
}
