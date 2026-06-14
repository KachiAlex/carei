import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { summarizeTranscript, saveVisit, getVisitDraft, deleteVisitDraft } from '../api/client'
import { useAutoSave } from '../hooks/useAutoSave'
import { triggerHaptic, HAPTIC_PATTERNS } from '../utils/haptic'
import { enqueue } from '../utils/offlineQueue'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
  lavender: '#A78BFA',
}

interface VisitSnapshot {
  visitId: string
  clientName: string
  clientAge: number
  clientAddress: string
  visitTime: string
  visitDuration: string
  elapsed: number
  tasks: { name: string; done: boolean; completedAt?: number }[]
  fluid: number
  notes: string
  medications: {
    name: string
    dose: string
    status: string
    skipReason?: string
    isControlled?: boolean
    administeredAt?: string
    witnessName?: string
    adminNote?: string
    dueTime?: string
  }[]
  clockInAt?: string
  clockOutAt: string
  bpSystolic?: number
  bpDiastolic?: number
  pulse?: number
  o2Sat?: number
  nutritionNote?: string
  mood?: string
  wellbeingNote?: string
  mealStatus?: string
  incidents?: { id: string; type: string; severity: string; description: string; timestamp: string }[]
  voiceMemos?: { id: string; audioUrl: string; duration: number; createdAt: string }[]
  status?: string
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatRecordTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function VisitSummaryScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/summary/:id')
  const visitId = params?.id || ''

  const [snapshot, setSnapshot] = useState<VisitSnapshot | null>(null)
  const [handoverNote, setHandoverNote] = useState('')
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Phase 5: Structured handover form fields
  const [handoverMood, setHandoverMood] = useState<'positive' | 'neutral' | 'low' | 'distressed'>('neutral')
  const [tasksCompleted, setTasksCompleted] = useState<string[]>([])
  const [concerns, setConcerns] = useState<string[]>([])
  const [otherNotes, setOtherNotes] = useState('')

  useAutoSave(visitId, { handoverNote, handoverMood, tasksCompleted, concerns, otherNotes }, 3000)

  useEffect(() => {
    if (!visitId) return
    getVisitDraft(visitId)
      .then((data) => {
        if (!data) return
        if (data.snapshot) setSnapshot(data.snapshot)
        if (data.handoverNote) setHandoverNote(data.handoverNote)
        // Load structured form data
        if (data.handoverMood) setHandoverMood(data.handoverMood)
        if (data.tasksCompleted) setTasksCompleted(data.tasksCompleted)
        if (data.concerns) setConcerns(data.concerns)
        if (data.otherNotes) setOtherNotes(data.otherNotes)
      })
      .catch(() => {})
  }, [visitId])

  const generateHandover = async () => {
    if (!snapshot) return
    setGenerating(true)
    const context = [
      `Client: ${snapshot.clientName}, ${snapshot.clientAge} years`,
      `Duration: ${formatTime(snapshot.elapsed)}`,
      `Fluid intake: ${snapshot.fluid}ml`,
      `Tasks: ${snapshot.tasks.filter((t) => t.done).length}/${snapshot.tasks.length} completed`,
      `Medications: ${snapshot.medications.filter((m) => m.status === 'confirmed').length}/${snapshot.medications.length} confirmed`,
      `Notes: ${snapshot.notes || 'None'}`,
    ].join('\n')

    try {
      const data = await summarizeTranscript(context)
      setHandoverNote(data.summary)
    } catch (e: any) {
      setHandoverNote(`Handover for ${snapshot.clientName}: Visit completed in ${formatTime(snapshot.elapsed)}. ${snapshot.tasks.filter((t) => t.done).length} of ${snapshot.tasks.length} tasks done. Fluid: ${snapshot.fluid}ml. Medications: ${snapshot.medications.filter((m) => m.status === 'confirmed').length} confirmed.`)
    } finally {
      setGenerating(false)
    }
  }

  // Phase 5: Generate handover from structured form
  const generateStructuredHandover = () => {
    const moodText = {
      positive: 'Client was in positive spirits, engaged well throughout the visit.',
      neutral: 'Client was calm and neutral during the visit.',
      low: 'Client appeared low in mood, required additional support and encouragement.',
      distressed: 'Client showed signs of distress and needed reassurance and comfort.'
    }

    const lines: string[] = []
    lines.push(`Handover for ${snapshot?.clientName || 'Client'}:`)
    lines.push('')
    lines.push(`🧠 Mood: ${moodText[handoverMood]}`)
    lines.push('')
    
    if (tasksCompleted.length > 0) {
      lines.push('✅ Tasks Completed:')
      tasksCompleted.forEach((t) => lines.push(`   • ${t}`))
      lines.push('')
    }
    
    if (concerns.length > 0) {
      lines.push('⚠️ Concerns:')
      concerns.forEach((c) => lines.push(`   • ${c}`))
      lines.push('')
    }
    
    if (otherNotes.trim()) {
      lines.push('📝 Additional Notes:')
      lines.push(otherNotes)
    }
    
    setHandoverNote(lines.join('\n'))
  }

  const toggleTask = (task: string) => {
    setTasksCompleted((prev) =>
      prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
    )
  }

  const toggleConcern = (concern: string) => {
    setConcerns((prev) =>
      prev.includes(concern) ? prev.filter((c) => c !== concern) : [...prev, concern]
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const submitHandover = async () => {
    if (!snapshot) return
    const payload = {
      ...snapshot,
      handoverNote,
      handoverMood,
      tasksCompleted,
      concerns,
      otherNotes,
      submittedAt: new Date().toISOString(),
    }
    if (!navigator.onLine) {
      await enqueue({ type: 'visit', payload })
      triggerHaptic(HAPTIC_PATTERNS.success)
      setSubmitted(true)
      setTimeout(() => setLocation('/dashboard'), 1500)
      return
    }
    setSubmitting(true)
    try {
      await saveVisit(visitId, payload)
      try { await deleteVisitDraft(visitId) } catch (err: any) { console.error('deleteVisitDraft failed', err.message) }
      triggerHaptic(HAPTIC_PATTERNS.success)
      setSubmitted(true)
      setTimeout(() => setLocation('/dashboard'), 1500)
    } catch {
      setSubmitting(false)
      alert('Failed to submit. Please try again.')
    }
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Invalid route
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        No visit data found. Please complete a visit first.
      </div>
    )
  }

  const doneTasks = snapshot.tasks.filter((t) => t.done).length
  const confirmedMeds = snapshot.medications.filter((m) => m.status === 'confirmed').length
  const skippedMeds = snapshot.medications.filter((m) => m.status === 'skipped')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div
        className="px-6 pt-5 pb-6 text-white shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-15 pointer-events-none" style={{ background: COLORS.teal }} />
        <div className="relative z-10 flex items-center justify-between mb-4">
          <button
            onClick={() => setLocation('/dashboard')}
            className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors py-1 px-1 -ml-1 rounded-lg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Dashboard
          </button>
          <button
            onClick={handlePrint}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target"
            title="Print / PDF"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </button>
        </div>
        <div className="relative z-10 flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `linear-gradient(135deg, ${COLORS.teal}25, ${COLORS.teal2}15)`, color: COLORS.teal }}>
            {snapshot.clientName.split(' ').map((n) => n[0]).join('')}
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold">Visit Summary</h1>
            <p className="text-white/50 text-sm">{snapshot.clientName} · {snapshot.visitTime} · {snapshot.visitDuration}</p>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-1.5 mt-3">
          <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <span className="text-[11px] font-medium" style={{ color: '#22c55e' }}>Visit completed successfully</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
          {[
            { label: 'Duration', value: formatTime(snapshot.elapsed), icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            { label: 'Tasks Done', value: `${doneTasks}/${snapshot.tasks.length}`, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
            { label: 'Fluid', value: `${snapshot.fluid}ml`, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z"/></svg> },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl p-3 border border-slate-100 text-center shadow-sm">
              <div className="flex justify-center mb-1 text-slate-300">{m.icon}</div>
              <div className="text-base font-bold text-slate-800">{m.value}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Audit Trail Complete Badge */}
        {snapshot.status === 'completed' && (
          <div className="bg-white rounded-2xl p-3 border border-slate-100 mb-3 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">Audit Trail Complete</div>
              <div className="text-[10px] text-slate-500">All required fields present and visit submitted</div>
            </div>
          </div>
        )}

        {/* Visit Timeline */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Visit Timeline</h3>
          <div className="flex flex-col gap-0 relative">
            {/* Clock In */}
            {snapshot.clockInAt && (
              <div className="flex gap-3 py-2">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(79,209,197,0.1)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div className="w-px flex-1 bg-slate-200 my-1" />
                </div>
                <div className="pb-3">
                  <div className="text-xs font-semibold text-slate-700">Clocked In</div>
                  <div className="text-[10px] text-slate-400">{formatDateTime(snapshot.clockInAt)}</div>
                </div>
              </div>
            )}
            {/* Tasks with timestamps */}
            {snapshot.tasks.filter((t) => t.done && t.completedAt).map((task, i) => (
              <div key={`task-${i}`} className="flex gap-3 py-2">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(79,209,197,0.1)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  </div>
                  <div className="w-px flex-1 bg-slate-200 my-1" />
                </div>
                <div className="pb-3">
                  <div className="text-xs font-semibold text-slate-700">Task: {task.name}</div>
                  <div className="text-[10px] text-slate-400">{formatDateTime(new Date(task.completedAt!).toISOString())}</div>
                </div>
              </div>
            ))}
            {/* Vitals */}
            {(snapshot.bpSystolic || snapshot.pulse || snapshot.o2Sat) && (
              <div className="flex gap-3 py-2">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.1)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.lavender} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  </div>
                  <div className="w-px flex-1 bg-slate-200 my-1" />
                </div>
                <div className="pb-3">
                  <div className="text-xs font-semibold text-slate-700">Vitals Recorded</div>
                  <div className="text-[10px] text-slate-400">
                    {snapshot.bpSystolic && `${snapshot.bpSystolic}/${snapshot.bpDiastolic} mmHg`}
                    {snapshot.pulse && ` · ${snapshot.pulse} bpm`}
                    {snapshot.o2Sat && ` · ${snapshot.o2Sat}% O₂`}
                  </div>
                </div>
              </div>
            )}
            {/* Medications */}
            {snapshot.medications.filter((m) => m.status === 'confirmed' || m.status === 'refused').map((med, i) => (
              <div key={`med-${i}`} className="flex gap-3 py-2">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: med.status === 'confirmed' ? 'rgba(79,209,197,0.1)' : 'rgba(255,90,95,0.08)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={med.status === 'confirmed' ? COLORS.teal : COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 11-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3l8.5 8.5 8-8Z"/></svg>
                  </div>
                  <div className="w-px flex-1 bg-slate-200 my-1" />
                </div>
                <div className="pb-3">
                  <div className="text-xs font-semibold text-slate-700">
                    {med.name} {med.status === 'confirmed' ? 'Given' : 'Not Given'}
                    {med.isControlled && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,90,95,0.1)', color: COLORS.red }}>CONTROLLED</span>}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {med.dose}
                    {med.administeredAt && ` · ${formatDateTime(med.administeredAt)}`}
                    {med.witnessName && ` · Witnessed by ${med.witnessName}`}
                    {med.status === 'refused' && med.skipReason && ` · ${med.skipReason}`}
                  </div>
                </div>
              </div>
            ))}
            {/* Clock Out */}
            {snapshot.clockOutAt && (
              <div className="flex gap-3 py-2">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-700">Clocked Out</div>
                  <div className="text-[10px] text-slate-400">{formatDateTime(snapshot.clockOutAt)} · {formatTime(snapshot.elapsed)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Vitals Summary */}
        {(snapshot.bpSystolic || snapshot.pulse || snapshot.o2Sat) && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Vitals</h3>
            <div className="grid grid-cols-2 gap-3">
              {snapshot.bpSystolic && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Blood Pressure</div>
                  <div className="text-sm font-bold text-slate-800">{snapshot.bpSystolic}/{snapshot.bpDiastolic} <span className="text-[10px] font-normal text-slate-500">mmHg</span></div>
                </div>
              )}
              {snapshot.pulse && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Pulse</div>
                  <div className="text-sm font-bold text-slate-800">{snapshot.pulse} <span className="text-[10px] font-normal text-slate-500">bpm</span></div>
                </div>
              )}
              {snapshot.o2Sat && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">O₂ Saturation</div>
                  <div className="text-sm font-bold text-slate-800">{snapshot.o2Sat}<span className="text-[10px] font-normal text-slate-500">%</span></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Care Notes Summary */}
        {(snapshot.notes || snapshot.nutritionNote || snapshot.mood || snapshot.wellbeingNote || snapshot.mealStatus) && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Care Notes</h3>
            <div className="flex flex-col gap-2.5">
              {snapshot.mealStatus && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Meal:</span>
                  <span className="font-semibold text-slate-700 capitalize">{snapshot.mealStatus}</span>
                </div>
              )}
              {snapshot.mood && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Mood:</span>
                  <span className="font-semibold text-slate-700">{snapshot.mood}</span>
                </div>
              )}
              {snapshot.nutritionNote && (
                <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5">{snapshot.nutritionNote}</div>
              )}
              {snapshot.wellbeingNote && (
                <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5">{snapshot.wellbeingNote}</div>
              )}
              {snapshot.notes && (
                <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5">{snapshot.notes}</div>
              )}
            </div>
          </div>
        )}

        {/* Incidents */}
        {snapshot.incidents && snapshot.incidents.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Incidents</h3>
            <div className="flex flex-col gap-2">
              {snapshot.incidents.map((inc) => (
                <div key={inc.id} className="flex items-center gap-2 rounded-xl p-2.5 bg-slate-50">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: inc.severity === 'high' ? COLORS.red : inc.severity === 'medium' ? COLORS.amber : '#22c55e',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700">{inc.type}</div>
                    {inc.description && <div className="text-[10px] text-slate-500">{inc.description}</div>}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatDateTime(inc.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice Memos */}
        {snapshot.voiceMemos && snapshot.voiceMemos.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Voice Memos</h3>
            <div className="flex flex-col gap-2">
              {snapshot.voiceMemos.map((memo) => (
                <div key={memo.id} className="flex items-center gap-2 rounded-xl p-2.5 bg-slate-50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.lavender} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700">Voice Memo</div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatRecordTime(memo.duration)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase 5: Structured Handover Form */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-800">Structured Handover</h3>
            <button
              onClick={generateHandover}
              disabled={generating}
              className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer border-none disabled:opacity-50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
              style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/><path d="M2 12h20"/></svg>
              {generating ? 'AI Gen...' : 'AI Assist'}
            </button>
          </div>

          {/* Mood Selector */}
          <div className="mb-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Client Mood</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'positive', label: '😊 Positive', color: '#22c55e' },
                { key: 'neutral', label: '😐 Neutral', color: '#94a3b8' },
                { key: 'low', label: '😔 Low', color: '#f59e0b' },
                { key: 'distressed', label: '😟 Distressed', color: '#ef4444' },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setHandoverMood(m.key as any)}
                  className="py-2 rounded-xl text-[10px] font-semibold cursor-pointer border transition-all"
                  style={{
                    background: handoverMood === m.key ? `${m.color}15` : 'white',
                    borderColor: handoverMood === m.key ? m.color : 'rgba(0,0,0,0.08)',
                    color: handoverMood === m.key ? m.color : '#64748b',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tasks Completed */}
          <div className="mb-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Key Tasks Completed</div>
            <div className="flex flex-wrap gap-2">
              {snapshot.tasks.filter((t) => t.done).map((task) => (
                <button
                  key={task.name}
                  onClick={() => toggleTask(task.name)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer border transition-all"
                  style={{
                    background: tasksCompleted.includes(task.name) ? 'rgba(79,209,197,0.1)' : 'white',
                    borderColor: tasksCompleted.includes(task.name) ? COLORS.teal : 'rgba(0,0,0,0.08)',
                    color: tasksCompleted.includes(task.name) ? COLORS.teal : '#64748b',
                  }}
                >
                  {tasksCompleted.includes(task.name) ? '✓ ' : ''}{task.name}
                </button>
              ))}
            </div>
          </div>

          {/* Concerns */}
          <div className="mb-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Concerns / Follow-ups</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {[
                'Skin integrity check needed',
                'Medication concerns',
                'Mobility issues',
                'Appetite reduced',
                'Sleep disturbance',
                'Family contact required',
              ].map((concern) => (
                <button
                  key={concern}
                  onClick={() => toggleConcern(concern)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer border transition-all"
                  style={{
                    background: concerns.includes(concern) ? 'rgba(246,183,60,0.1)' : 'white',
                    borderColor: concerns.includes(concern) ? COLORS.amber : 'rgba(0,0,0,0.08)',
                    color: concerns.includes(concern) ? '#d97706' : '#64748b',
                  }}
                >
                  {concerns.includes(concern) ? '⚠️ ' : '+'}{concern}
                </button>
              ))}
            </div>
          </div>

          {/* Other Notes */}
          <div className="mb-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Additional Notes</div>
            <textarea
              value={otherNotes}
              onChange={(e) => setOtherNotes(e.target.value)}
              placeholder="Any other important information for the next carer..."
              className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors"
              rows={2}
            />
          </div>

          {/* Generate from Structured Form */}
          <button
            onClick={generateStructuredHandover}
            className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer border transition-all flex items-center justify-center gap-2 mb-4"
            style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: '#f8fafc' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18"/><path d="m6 9 6-6 6 6"/><path d="m6 15 6 6 6-6"/>
            </svg>
            Generate Handover from Form
          </button>

          {/* Final Handover Note */}
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Final Handover Note</div>
          <textarea
            value={handoverNote}
            onChange={(e) => setHandoverNote(e.target.value)}
            placeholder="Generated handover note will appear here..."
            className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors"
            rows={4}
          />
        </div>

        {/* Submit */}
        <button
          onClick={submitHandover}
          disabled={submitting || submitted}
          className="w-full py-4 rounded-2xl font-bold text-base cursor-pointer border-none mb-6 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy, boxShadow: `0 8px 32px ${COLORS.teal}30` }}
        >
          {submitted ? (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Handover Submitted</>
          ) : submitting ? (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Submitting...</>
          ) : (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Submit Handover</>
          )}
        </button>
      </div>
    </div>
  )
}
