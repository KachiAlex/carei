import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { summarizeTranscript, saveVisit } from '../api/client'
import { useAutoSave } from '../hooks/useAutoSave'
import { triggerHaptic, HAPTIC_PATTERNS } from '../utils/haptic'
import { enqueue } from '../utils/offlineQueue'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
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
        className="px-6 py-5 text-white shrink-0"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setLocation('/dashboard')}
            className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer"
          >
            ← Dashboard
          </button>
          <button
            onClick={handlePrint}
            className="text-white/60 hover:text-white text-xs bg-transparent border-none cursor-pointer flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print / PDF
          </button>
        </div>
        <h1 className="font-serif text-xl">Visit Summary</h1>
        <p className="text-white/50 text-sm">{snapshot.clientName} · {snapshot.visitTime} · {snapshot.visitDuration}</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Duration', value: formatTime(snapshot.elapsed) },
            { label: 'Tasks Done', value: `${doneTasks}/${snapshot.tasks.length}` },
            { label: 'Fluid', value: `${snapshot.fluid}ml` },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl p-3 border border-slate-200 text-center">
              <div className="text-lg font-bold text-slate-800">{m.value}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Medications */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Medications</h3>
          <div className="flex flex-col gap-2">
            {snapshot.medications.map((med) => (
              <div key={med.name} className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-700">{med.name}</div>
                  <div className="text-slate-400">{med.dose}</div>
                </div>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    color: med.status === 'confirmed' ? COLORS.teal : med.status === 'skipped' ? COLORS.red : '#94a3b8',
                    background: med.status === 'confirmed' ? 'rgba(79,209,197,0.1)' : med.status === 'skipped' ? 'rgba(255,90,95,0.08)' : '#f1f5f9',
                  }}
                >
                  {med.status === 'confirmed' ? '✓ Confirmed' : med.status === 'skipped' ? `⊘ ${med.skipReason || 'Skipped'}` : 'Pending'}
                </span>
              </div>
            ))}
          </div>
          {skippedMeds.length > 0 && (
            <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
              ⚠️ {skippedMeds.length} medication(s) skipped — flagged for review.
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Tasks</h3>
          <div className="flex flex-col gap-1.5">
            {snapshot.tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{
                    background: task.done ? COLORS.teal : 'transparent',
                    border: `1px solid ${task.done ? COLORS.teal : '#cbd5e1'}`,
                  }}
                >
                  {task.done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
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
          <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
            <h3 className="font-bold text-sm text-slate-800 mb-2">Care Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{snapshot.notes}</p>
          </div>
        )}

        {/* Handover Note */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-slate-800">Handover Note</h3>
            <button
              onClick={generateHandover}
              disabled={generating}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer border-none disabled:opacity-50"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              {generating ? 'Generating...' : '✨ Auto-Generate'}
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
          className="w-full py-3.5 rounded-full font-bold text-base cursor-pointer border-none mb-6 disabled:opacity-50"
          style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
        >
          {submitted ? '✓ Handover Submitted' : submitting ? 'Submitting...' : 'Submit Handover →'}
        </button>
      </div>
    </div>
  )
}
