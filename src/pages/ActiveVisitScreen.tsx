import { useState, useEffect, useRef } from 'react'
import { useLocation, useParams } from 'wouter'
import { todayVisits, clients } from '../data/clients'
import { useAutoSave } from '../hooks/useAutoSave'
import { triggerHaptic, HAPTIC_PATTERNS } from '../utils/haptic'
import { enqueue } from '../utils/offlineQueue'
import { fetchVisit, saveVisit, sendSOS } from '../api/client'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
}

export default function ActiveVisitScreen() {
  const params = useParams<{ id: string }>()
  const visitId = params?.id || ''
  const [, setLocation] = useLocation()

  const visit = todayVisits.find((v) => v.id === visitId)
  const client = visit ? clients.find((c) => c.id === visit.clientId) : null

  const [clockedIn, setClockedIn] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [tasks, setTasks] = useState(visit?.tasks.map((t) => ({ name: t, done: false })) || [])
  const [fluid, setFluid] = useState(0)
  const [notes, setNotes] = useState('')
  const [showBodyMap, setShowBodyMap] = useState(false)
  const [showVoiceDoc, setShowVoiceDoc] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [showClockOut, setShowClockOut] = useState(false)
  const [showSOSConfirm, setShowSOSConfirm] = useState(false)
  const [meds, setMeds] = useState<{ name: string; dose: string; status: 'pending' | 'confirmed' | 'skipped'; skipReason?: string }[]>(() => {
    const saved = localStorage.getItem(`carei_active_${visitId}`)
    if (saved) try { const d = JSON.parse(saved); if (d.meds) return d.meds } catch {}
    return client?.medications.map((m) => ({ name: m.name, dose: m.dose, status: 'pending' })) || []
  })
  const [showMedConfirm, setShowMedConfirm] = useState(false)
  const [selectedMed, setSelectedMed] = useState<string | null>(null)
  const [showSkipReason, setShowSkipReason] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<any>(null)
  const dbSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useAutoSave(`carei_active_${visitId}`, { visitId, elapsed, tasks, fluid, notes, meds, clockedIn }, 3000)

  // Load existing visit data from DB on mount
  useEffect(() => {
    if (!visitId) return
    fetchVisit(visitId)
      .then((data) => {
        if (data && data.id && data.elapsed != null) {
          setElapsed(data.elapsed)
          if (data.tasks) setTasks(data.tasks)
          if (data.fluid != null) setFluid(data.fluid)
          if (data.notes) setNotes(data.notes)
          if (data.medications) setMeds(data.medications)
          if (data.clock_out_at) setClockedIn(false)
        }
      })
      .catch(() => {})
  }, [visitId])

  // Debounced auto-save to DB
  useEffect(() => {
    if (!visitId || !clockedIn) return
    if (dbSyncRef.current) clearTimeout(dbSyncRef.current)
    dbSyncRef.current = setTimeout(() => {
      const payload = {
        visitId,
        clientName: client?.name,
        clientAge: client?.age,
        clientAddress: client?.address,
        visitTime: visit?.time,
        visitDuration: visit?.duration,
        elapsed,
        tasks,
        fluid,
        notes,
        medications: meds,
      }
      saveVisit(visitId, payload).catch(() => {})
    }, 5000)
    return () => { if (dbSyncRef.current) clearTimeout(dbSyncRef.current) }
  }, [visitId, elapsed, tasks, fluid, notes, meds, clockedIn, client, visit])

  useEffect(() => {
    if (clockedIn) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [clockedIn])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const toggleTask = (idx: number) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, done: !t.done } : t)))
    triggerHaptic(HAPTIC_PATTERNS.tap)
  }

  const addFluid = () => {
    setFluid((f) => f + 250)
    triggerHaptic(HAPTIC_PATTERNS.tap)
  }

  const startVoiceDoc = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice documentation not supported in this browser')
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: any) => {
      let txt = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript
      }
      setTranscript(txt)
    }
    rec.onend = () => setIsRecording(false)
    rec.start()
    recognitionRef.current = rec
    setIsRecording(true)
  }

  const stopVoiceDoc = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  const saveVoiceDoc = () => {
    setNotes((n) => (n ? n + '\n' + transcript : transcript))
    setTranscript('')
    setShowVoiceDoc(false)
  }

  const handleSOS = () => {
    setShowSOSConfirm(true)
    triggerHaptic(HAPTIC_PATTERNS.sos)
    setTimeout(() => setShowSOSConfirm(false), 15000)
  }

  const confirmSOS = async () => {
    setShowSOSConfirm(false)
    triggerHaptic(HAPTIC_PATTERNS.sos)
    const payload = { visitId, location: client?.address, timestamp: new Date().toISOString() }
    if (!navigator.onLine) {
      await enqueue({ type: 'sos', payload })
      alert('SOS queued — will send when back online.')
      return
    }
    try {
      await sendSOS(payload)
      alert('SOS Alert Sent! Supervisor notified.')
    } catch {
      alert('Failed to send SOS. Please retry.')
    }
  }

  const confirmMed = (medName: string) => {
    setMeds((prev) =>
      prev.map((m) => (m.name === medName ? { ...m, status: 'confirmed' as const } : m))
    )
    triggerHaptic(HAPTIC_PATTERNS.confirm)
    setShowMedConfirm(false)
  }

  const skipMed = (medName: string, reason: string) => {
    setMeds((prev) =>
      prev.map((m) => (m.name === medName ? { ...m, status: 'skipped' as const, skipReason: reason } : m))
    )
    triggerHaptic(HAPTIC_PATTERNS.confirm)
    setShowSkipReason(false)
    setShowMedConfirm(false)
  }

  const pendingMedsCount = meds.filter((m) => m.status === 'pending').length
  const allMedsHandled = meds.every((m) => m.status !== 'pending')

  if (!visit || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Visit not found
      </div>
    )
  }

  // Pre-clock-in briefing view
  if (!clockedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <div
          className="px-6 py-5 text-white shrink-0"
          style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
        >
          <button
            onClick={() => setLocation('/dashboard')}
            className="text-white/60 hover:text-white text-sm flex items-center gap-1 mb-3 bg-transparent border-none cursor-pointer"
          >
            ← Back
          </button>
          <h1 className="font-serif text-xl">Pre-Visit Briefing</h1>
          <p className="text-white/50 text-sm">{client.name} — {visit.time}</p>
        </div>

        <div className="flex-1 px-4 py-4 overflow-auto">
          {/* Client Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
            <div className="font-bold text-slate-800 mb-1">{client.name}</div>
            <div className="text-xs text-slate-500 mb-2">{client.age} years · {client.address}</div>
            {visit.flags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {visit.flags.map((f) => (
                  <span key={f} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,90,95,0.08)', color: COLORS.red, border: '1px solid rgba(255,90,95,0.15)' }}>
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Three-Point Briefing */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Shift Briefing</h3>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(79,209,197,0.1)' }}>👁️</div>
                <div>
                  <div className="text-xs font-bold text-slate-700">Key Observations</div>
                  <div className="text-xs text-slate-500">{client.conditions.join(', ')}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(79,209,197,0.1)' }}>📋</div>
                <div>
                  <div className="text-xs font-bold text-slate-700">Open Tasks</div>
                  <div className="text-xs text-slate-500">{visit.tasks.join(', ')}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(79,209,197,0.1)' }}>🚩</div>
                <div>
                  <div className="text-xs font-bold text-slate-700">Flags</div>
                  <div className="text-xs text-slate-500">{client.preferences}</div>
                  {client.emergencyContact && (
                    <div className="text-xs text-slate-500 mt-1">Emergency: {client.emergencyContact}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Medications */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-4">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Medications Due</h3>
            <div className="flex flex-col gap-2">
              {client.medications.map((med) => (
                <div key={med.name} className="flex items-center justify-between text-xs py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="font-semibold text-slate-700">{med.name}</div>
                    <div className="text-slate-400">{med.dose} · {med.frequency}</div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-teal shrink-0" />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setClockedIn(true)}
            className="w-full py-3.5 rounded-full font-bold text-base cursor-pointer border-none"
            style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
          >
            Clock In →
          </button>
        </div>
      </div>
    )
  }

  // Active Visit view
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {/* Header */}
      <div
        className="px-4 py-4 text-white shrink-0"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setClockedIn(false)}
            className="text-white/60 hover:text-white text-xs bg-transparent border-none cursor-pointer"
          >
            ← Back
          </button>
          <div className="font-mono text-sm font-bold">{formatTime(elapsed)}</div>
        </div>
        <div className="font-bold text-sm">{client.name}</div>
        <div className="text-xs text-white/50">{visit.time} · {visit.duration}</div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Medication Summary */}
        <div
          className="bg-white rounded-2xl p-4 border border-slate-200 mb-3 cursor-pointer"
          onClick={() => setShowMedConfirm(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Medications</div>
              <div className="font-bold text-sm text-slate-800">
                {meds.filter((m) => m.status === 'confirmed').length}/{meds.length} confirmed
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingMedsCount > 0 && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                  {pendingMedsCount} pending
                </span>
              )}
              <span className="text-slate-400 text-sm">→</span>
            </div>
          </div>
        </div>

        {/* Fluid Counter */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Fluid Intake</div>
            <div className="font-bold text-lg text-slate-800">{fluid} ml</div>
          </div>
          <button
            onClick={addFluid}
            className="w-10 h-10 rounded-full text-white text-xl font-bold flex items-center justify-center cursor-pointer border-none"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
            aria-label="Add 250ml fluid"
          >
            +
          </button>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Tasks</h3>
          <div className="flex flex-col gap-2">
            {tasks.map((task, idx) => (
              <button
                key={idx}
                onClick={() => toggleTask(idx)}
                className="flex items-center gap-3 text-left p-2 rounded-xl cursor-pointer border-none bg-transparent hover:bg-slate-50 transition-colors"
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors"
                  style={{
                    background: task.done ? COLORS.teal : 'transparent',
                    borderColor: task.done ? COLORS.teal : '#cbd5e1',
                  }}
                >
                  {task.done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${task.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
          <h3 className="font-bold text-sm text-slate-800 mb-2">Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add observations..."
            className="w-full bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none border border-slate-100 focus:border-teal transition-colors"
            rows={3}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setShowVoiceDoc(true)}
            className="py-3.5 rounded-xl text-xs font-semibold border cursor-pointer flex items-center justify-center gap-1 min-h-[48px]"
            style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: 'white' }}
            aria-label="Voice documentation"
          >
            🎤 Voice Doc
          </button>
          <button
            onClick={() => setShowBodyMap(true)}
            className="py-3.5 rounded-xl text-xs font-semibold border cursor-pointer flex items-center justify-center gap-1 min-h-[48px]"
            style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: 'white' }}
            aria-label="Body map photo"
          >
            🩹 Body Map
          </button>
        </div>

        {/* Clock Out */}
        <button
          onClick={() => {
            if (!allMedsHandled) {
              alert('Please confirm or skip all medications before clocking out.')
              setShowMedConfirm(true)
              return
            }
            setShowClockOut(true)
          }}
          className="w-full py-3.5 rounded-full font-bold text-base cursor-pointer border-none mb-6"
          style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
        >
          Clock Out →
        </button>
      </div>

      {/* SOS Floating Button */}
      <button
        onClick={handleSOS}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white font-bold text-sm shadow-lg cursor-pointer border-none z-50 flex items-center justify-center"
        style={{ background: COLORS.red, boxShadow: '0 8px 32px rgba(255,90,95,0.4)' }}
        aria-label="SOS Emergency"
      >
        SOS
      </button>

      {/* Voice Documentation Modal */}
      {showVoiceDoc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-bold text-slate-800 mb-3">Voice Documentation</h3>
            <div className="bg-slate-50 rounded-xl p-3 mb-3 min-h-[60px] text-sm text-slate-600">
              {transcript || (isRecording ? 'Listening...' : 'Tap record to start')}
            </div>
            <div className="flex gap-2 mb-4">
              {!isRecording ? (
                <button
                  onClick={startVoiceDoc}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                  style={{ background: COLORS.red }}
                >
                  ● Record
                </button>
              ) : (
                <button
                  onClick={stopVoiceDoc}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                  style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
                >
                  ⏹ Stop
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowVoiceDoc(false); setTranscript(''); stopVoiceDoc() }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={saveVoiceDoc}
                disabled={!transcript}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-40"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body Map Modal */}
      {showBodyMap && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-bold text-slate-800 mb-3">Body Map Photo</h3>
            <p className="text-sm text-slate-500 mb-4">Take a photo of any skin concerns, bruises, or wounds. This will be auto-tagged to this visit.</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="w-full mb-4 text-sm text-slate-500"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setNotes((n) => n + '\n[Body map photo captured]')
                  setShowBodyMap(false)
                }
              }}
            />
            <button
              onClick={() => setShowBodyMap(false)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Clock Out Confirmation */}
      {showClockOut && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-bold text-slate-800 mb-2">Clock Out?</h3>
            <div className="text-sm text-slate-500 mb-4">
              <div>Time: {formatTime(elapsed)}</div>
              <div>Fluid: {fluid} ml</div>
              <div>Tasks: {tasks.filter((t) => t.done).length}/{tasks.length} done</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClockOut(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowClockOut(false)
                  triggerHaptic(HAPTIC_PATTERNS.clockOut)
                  const snapshot = {
                    visitId: visit.id,
                    clientName: client.name,
                    clientAge: client.age,
                    clientAddress: client.address,
                    visitTime: visit.time,
                    visitDuration: visit.duration,
                    elapsed,
                    tasks: tasks.map((t) => ({ name: t.name, done: t.done })),
                    fluid,
                    notes,
                    medications: meds.map((m) => ({ name: m.name, dose: m.dose, status: m.status, skipReason: m.skipReason })),
                    clockOutAt: new Date().toISOString(),
                  }
                  localStorage.setItem(`carei_visit_${visit.id}`, JSON.stringify(snapshot))
                  try { await saveVisit(visit.id, snapshot) } catch {}
                  setLocation(`/summary/${visit.id}`)
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                Confirm Clock Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medication Confirmation Modal */}
      {showMedConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-slate-800 mb-1">Medication Confirmation</h3>
            <p className="text-xs text-slate-500 mb-4">{client.name} · Tap to confirm each medication</p>
            <div className="flex flex-col gap-2 mb-4">
              {meds.map((med) => (
                <div
                  key={med.name}
                  className="flex items-center justify-between p-3 rounded-xl border"
                  style={{
                    background: med.status === 'confirmed' ? 'rgba(79,209,197,0.06)' : med.status === 'skipped' ? 'rgba(255,90,95,0.04)' : 'white',
                    borderColor: med.status === 'confirmed' ? 'rgba(79,209,197,0.3)' : med.status === 'skipped' ? 'rgba(255,90,95,0.2)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-700">{med.name}</div>
                    <div className="text-xs text-slate-400">{med.dose}</div>
                    {med.status === 'skipped' && med.skipReason && (
                      <div className="text-[10px] text-red-400 mt-0.5">Skipped: {med.skipReason}</div>
                    )}
                  </div>
                  {med.status === 'pending' ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => confirmMed(med.name)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white border-none cursor-pointer"
                        style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setSelectedMed(med.name); setShowSkipReason(true) }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                        style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
                      >
                        Skip
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ color: med.status === 'confirmed' ? COLORS.teal : COLORS.red, background: med.status === 'confirmed' ? 'rgba(79,209,197,0.1)' : 'rgba(255,90,95,0.08)' }}>
                      {med.status === 'confirmed' ? '✓ Confirmed' : '⊘ Skipped'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowMedConfirm(false)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Skip Reason Modal */}
      {showSkipReason && selectedMed && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-bold text-slate-800 mb-1">Skip {selectedMed}</h3>
            <p className="text-xs text-slate-500 mb-4">Why was this medication not given?</p>
            <div className="flex flex-col gap-2 mb-4">
              {['Client refused', 'Client asleep', 'Client unavailable', 'Other'].map((reason) => (
                <button
                  key={reason}
                  onClick={() => skipMed(selectedMed, reason)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm border cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#475569', background: 'white' }}
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowSkipReason(false); setSelectedMed(null) }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SOS Confirmation Modal */}
      {showSOSConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,90,95,0.1)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2 text-slate-800">Emergency Alert</h3>
            <p className="text-sm text-slate-500 mb-6">This will immediately notify your supervisor and log your GPS location.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowSOSConfirm(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold border cursor-pointer" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: 'transparent' }}>Cancel</button>
              <button onClick={confirmSOS} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer" style={{ background: COLORS.red }}>Send Alert</button>
            </div>
            <p className="text-[10px] text-slate-400 mt-3">Auto-cancels in 15 seconds</p>
          </div>
        </div>
      )}
    </div>
  )
}
