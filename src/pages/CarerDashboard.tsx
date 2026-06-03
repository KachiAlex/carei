import { useState, useMemo } from 'react'
import { useLocation } from 'wouter'
import { todayVisits } from '../data/clients'
import type { Visit } from '../data/clients'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  amber: '#F6B73C',
  red: '#FF5A5F',
}

function getStatusDot(status: Visit['status']) {
  const map: Record<Visit['status'], string> = {
    completed: '#22c55e',
    'in-progress': COLORS.teal,
    pending: '#94a3b8',
    missed: COLORS.red,
  }
  return map[status]
}

function getStatusLabel(status: Visit['status']) {
  const map: Record<Visit['status'], string> = {
    completed: 'Completed',
    'in-progress': 'In Progress',
    pending: 'Upcoming',
    missed: 'Missed',
  }
  return map[status]
}

export default function CarerDashboard() {
  const [, setLocation] = useLocation()
  const [playingBrief, setPlayingBrief] = useState<string | null>(null)
  const [showSOSConfirm, setShowSOSConfirm] = useState(false)

  const stats = useMemo(() => {
    const total = todayVisits.length
    const completed = todayVisits.filter((v) => v.status === 'completed').length
    const inProgress = todayVisits.filter((v) => v.status === 'in-progress').length
    const pending = todayVisits.filter((v) => v.status === 'pending').length
    const hours = (todayVisits.reduce((acc, v) => {
      const m = parseInt(v.duration)
      return acc + (isNaN(m) ? 0 : m)
    }, 0) / 60).toFixed(1)
    return { total, completed, inProgress, pending, hours }
  }, [])

  const handleBriefing = (visitId: string) => {
    if (playingBrief === visitId) {
      setPlayingBrief(null)
      window.speechSynthesis?.cancel()
      return
    }
    window.speechSynthesis?.cancel()
    setPlayingBrief(visitId)
    const visit = todayVisits.find((v) => v.id === visitId)
    if (visit && 'speechSynthesis' in window) {
      const text = `Visit with ${visit.clientName} at ${visit.time}. Tasks: ${visit.tasks.join(', ')}.${visit.flags.length > 0 ? ` Flags: ${visit.flags.join(', ')}.` : ''}`
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1
      utter.onend = () => setPlayingBrief(null)
      window.speechSynthesis.speak(utter)
    }
  }

  const handleSOS = () => {
    setShowSOSConfirm(true)
    setTimeout(() => setShowSOSConfirm(false), 15000)
  }

  const confirmSOS = () => {
    setShowSOSConfirm(false)
    alert('SOS Alert Sent! Supervisor notified.')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {/* Header */}
      <div
        className="px-6 py-5 text-white shrink-0"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-teal/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold">Sarah</div>
              <div className="text-xs text-white/50">Carer — Manchester</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation('/copilot')}
              className="text-white/60 hover:text-white text-xs bg-transparent border-none cursor-pointer flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
              </svg>
              AI
            </button>
            <button
              onClick={() => setLocation('/')}
              className="text-white/60 hover:text-white text-xs bg-transparent border-none cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>

        <h1 className="font-serif text-xl mb-4">Today's Care</h1>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Visits', value: stats.total },
            { label: 'Done', value: stats.completed },
            { label: 'Pending', value: stats.pending },
            { label: 'Hours', value: stats.hours },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Visit List */}
      <div className="flex-1 px-4 py-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700">Scheduled Visits</h2>
          <span className="text-xs text-slate-400">{todayVisits.length} today</span>
        </div>

        <div className="flex flex-col gap-3">
          {todayVisits.map((visit) => (
            <div
              key={visit.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: getStatusDot(visit.status) }}
                  />
                  <span className="font-bold text-sm text-slate-800">{visit.clientName}</span>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {getStatusLabel(visit.status)}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {visit.time}
                </span>
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 8 10" />
                  </svg>
                  {visit.duration}
                </span>
              </div>

              {visit.flags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {visit.flags.map((flag) => (
                    <span
                      key={flag}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,90,95,0.08)', color: COLORS.red, border: '1px solid rgba(255,90,95,0.15)' }}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 mb-3">
                {visit.tasks.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                    {t}
                  </span>
                ))}
                {visit.tasks.length > 3 && (
                  <span className="text-[10px] text-slate-400">+{visit.tasks.length - 3}</span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleBriefing(visit.id)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border cursor-pointer"
                  style={{
                    borderColor: playingBrief === visit.id ? COLORS.teal : 'rgba(0,0,0,0.08)',
                    color: playingBrief === visit.id ? COLORS.teal : '#64748b',
                    background: playingBrief === visit.id ? 'rgba(79,209,197,0.08)' : 'transparent',
                  }}
                >
                  <span className="text-[10px]">{playingBrief === visit.id ? '⏸' : '▶'}</span>
                  {playingBrief === visit.id ? 'Stop Briefing' : 'Audio Briefing'}
                </button>
                <button
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white border-none cursor-pointer"
                  style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                  onClick={() => setLocation(`/visit/${visit.id}`)}
                >
                  {visit.status === 'in-progress' ? 'Continue' : 'Start'}
                </button>
              </div>
            </div>
          ))}
        </div>
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

      {/* SOS Confirmation Modal */}
      {showSOSConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(255,90,95,0.1)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2 text-slate-800">Emergency Alert</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will immediately notify your supervisor and log your GPS location.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSOSConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSOS}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                style={{ background: COLORS.red }}
              >
                Send Alert
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-3">Auto-cancels in 15 seconds</p>
          </div>
        </div>
      )}
    </div>
  )
}
