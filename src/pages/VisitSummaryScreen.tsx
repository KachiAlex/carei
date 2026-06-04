import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { summarizeTranscript, saveVisit } from '../api/client'
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
}

interface VisitSnapshot {
  visitId: string
  clientName: string
  clientAge: number
  clientAddress: string
  visitTime: string
  visitDuration: string
  elapsed: number
  tasks: { name: string; done: boolean }[]
  fluid: number
  notes: string
  medications: { name: string; dose: string; status: string; skipReason?: string }[]
  clockOutAt: string
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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

  useAutoSave(`carei_handover_${visitId}`, { handoverNote }, 3000)

  useEffect(() => {
    const raw = localStorage.getItem(`carei_visit_${visitId}`)
    if (raw) {
      try {
        setSnapshot(JSON.parse(raw))
      } catch {
        // ignore
      }
    }
    const savedHandover = localStorage.getItem(`carei_handover_${visitId}`)
    if (savedHandover) {
      try {
        const d = JSON.parse(savedHandover)
        if (d.handoverNote) setHandoverNote(d.handoverNote)
      } catch {}
    }
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

  const handlePrint = () => {
    window.print()
  }

  const submitHandover = async () => {
    if (!snapshot) return
    const payload = {
      ...snapshot,
      handoverNote,
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
      localStorage.removeItem(`carei_visit_${visitId}`)
      localStorage.removeItem(`carei_handover_${visitId}`)
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
            className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Dashboard
          </button>
          <button
            onClick={handlePrint}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer"
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
        <div className="grid grid-cols-3 gap-2.5 mb-4">
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

        {/* Medications */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-800">Medications</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>{confirmedMeds}/{snapshot.medications.length} confirmed</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {snapshot.medications.map((med) => (
              <div key={med.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: med.status === 'confirmed' ? 'rgba(79,209,197,0.08)' : med.status === 'skipped' ? 'rgba(255,90,95,0.06)' : 'rgba(148,163,184,0.08)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={med.status === 'confirmed' ? COLORS.teal : med.status === 'skipped' ? COLORS.red : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 11-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3l8.5 8.5 8-8Z"/></svg>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700">{med.name}</div>
                    <div className="text-slate-400">{med.dose}</div>
                  </div>
                </div>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    color: med.status === 'confirmed' ? COLORS.teal : med.status === 'skipped' ? COLORS.red : '#94a3b8',
                    background: med.status === 'confirmed' ? 'rgba(79,209,197,0.08)' : med.status === 'skipped' ? 'rgba(255,90,95,0.06)' : '#f1f5f9',
                    border: `1px solid ${med.status === 'confirmed' ? 'rgba(79,209,197,0.15)' : med.status === 'skipped' ? 'rgba(255,90,95,0.1)' : 'transparent'}`,
                  }}
                >
                  {med.status === 'confirmed' ? 'Confirmed' : med.status === 'skipped' ? `${med.skipReason || 'Skipped'}` : 'Pending'}
                </span>
              </div>
            ))}
          </div>
          {skippedMeds.length > 0 && (
            <div className="mt-3 text-[10px] text-amber-700 rounded-lg px-3 py-2.5 flex items-center gap-1.5" style={{ background: 'rgba(246,183,60,0.08)', border: '1px solid rgba(246,183,60,0.12)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.amber} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              {skippedMeds.length} medication(s) skipped — flagged for review.
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-800">Tasks</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>{doneTasks}/{snapshot.tasks.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {snapshot.tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    background: task.done ? COLORS.teal : 'transparent',
                    border: `1.5px solid ${task.done ? COLORS.teal : '#cbd5e1'}`,
                  }}
                >
                  {task.done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className={task.done ? 'text-slate-400 line-through' : 'text-slate-700'}>{task.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {snapshot.notes && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 mb-2">Care Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{snapshot.notes}</p>
          </div>
        )}

        {/* Handover Note */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-slate-800">Handover Note</h3>
            <button
              onClick={generateHandover}
              disabled={generating}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-xl cursor-pointer border-none disabled:opacity-50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
              style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/><path d="M2 12h20"/></svg>
              {generating ? 'Generating...' : 'Auto-Generate'}
            </button>
          </div>
          <textarea
            value={handoverNote}
            onChange={(e) => setHandoverNote(e.target.value)}
            placeholder="Write a handover note for the next carer..."
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
