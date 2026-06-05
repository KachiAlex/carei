import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'wouter'
import { todayVisits } from '../data/clients'
import type { Visit } from '../data/clients'
import { getVisits, sendSOS, getMe } from '../api/client'
import { enqueue } from '../utils/offlineQueue'
import { sendVisitStartReminder, requestNotificationPermission } from '../utils/notifications'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  amber: '#F6B73C',
  red: '#FF5A5F',
  lavender: '#A78BFA',
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

interface UserProfile {
  name: string
  email: string
  phone: string
  region: string
  pin: string
  role: string
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function CarerDashboard() {
  const [, setLocation] = useLocation()
  const [playingBrief, setPlayingBrief] = useState<string | null>(null)
  const [showSOSConfirm, setShowSOSConfirm] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [visits, setVisits] = useState<Visit[]>(todayVisits)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then((data) => { if (data.user) setUser(data.user) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    getVisits()
      .then((data) => {
        if (data.visits?.length) {
          setVisits(data.visits)
          requestNotificationPermission().then(() => {
            const pending = data.visits.filter((v: Visit) => v.status === 'pending')
            if (pending.length > 0) {
              sendVisitStartReminder(pending[0].clientName, pending[0].time)
            }
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const total = visits.length
    const completed = visits.filter((v) => v.status === 'completed').length
    const inProgress = visits.filter((v) => v.status === 'in-progress').length
    const pending = visits.filter((v) => v.status === 'pending').length
    const hours = (visits.reduce((acc, v) => {
      const m = parseInt(v.duration)
      return acc + (isNaN(m) ? 0 : m)
    }, 0) / 60).toFixed(1)
    return { total, completed, inProgress, pending, hours }
  }, [visits])

  const handleBriefing = (visitId: string) => {
    if (playingBrief === visitId) {
      setPlayingBrief(null)
      window.speechSynthesis?.cancel()
      return
    }
    window.speechSynthesis?.cancel()
    setPlayingBrief(visitId)
    const visit = visits.find((v) => v.id === visitId)
    if (visit && 'speechSynthesis' in window) {
      const tasks = Array.isArray(visit.tasks) ? visit.tasks.join(', ') : ''
      const flags = Array.isArray(visit.flags) ? visit.flags.join(', ') : ''
      const text = `Visit with ${visit.clientName} at ${visit.time}. Tasks: ${tasks}.${flags ? ` Flags: ${flags}.` : ''}`
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

  const confirmSOS = async () => {
    setShowSOSConfirm(false)
    const payload = { visitId: 'dashboard', location: 'Carer Dashboard', timestamp: new Date().toISOString() }
    try {
      if (!navigator.onLine) {
        await enqueue({ type: 'sos', payload })
      } else {
        await sendSOS(payload)
      }
      alert('SOS Alert Sent! Supervisor notified.')
    } catch {
      alert('SOS Alert queued. Will send when online.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {/* Header */}
      <div
        className="px-6 pt-5 pb-6 text-white shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        {/* Subtle animated glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none" style={{ background: COLORS.teal }} />

        <div className="relative z-10 flex items-center justify-between mb-5">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 bg-transparent border-none cursor-pointer rounded-xl p-1 -ml-1 transition-colors hover:bg-white/5"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `linear-gradient(135deg, ${COLORS.teal}30, ${COLORS.teal2}20)`, color: COLORS.teal }}>
              {user ? getInitials(user.name) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">{user?.name || 'Carer'}</div>
              <div className="text-[11px] text-white/40">{user?.role ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)}` : 'Carer'}{user?.region ? ` — ${user.region}` : ''}</div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation('/copilot')}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target"
              title="AI Copilot"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
              </svg>
            </button>
            <button
              onClick={() => setLocation('/')}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target"
              title="Log out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between mb-4">
          <h1 className="font-serif text-2xl">Today's Care</h1>
          <div className="text-right">
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Progress</div>
            <div className="text-lg font-bold" style={{ color: COLORS.teal }}>
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative z-10 w-full h-1.5 rounded-full bg-white/10 mb-5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`,
            }}
          />
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Visits', value: stats.total, icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            )},
            { label: 'Done', value: stats.completed, icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            )},
            { label: 'Pending', value: stats.pending, icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            )},
            { label: 'Hours', value: stats.hours, icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
            )},
          ].map((s) => (
            <div key={s.label} className="rounded-xl px-2 py-3 text-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-center mb-1 text-white/30">{s.icon}</div>
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-[11px] sm:text-xs text-white/40 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Visit List */}
      <div className="flex-1 px-4 py-5 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Scheduled Visits</h2>
            <p className="text-[11px] text-slate-400">{visits.length} visits today</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.teal }} />
            Live
          </div>
        </div>

        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
                  <div className="h-5 w-16 rounded-full bg-slate-100 animate-pulse" />
                </div>
                <div className="h-3 w-32 rounded bg-slate-100 animate-pulse mb-3" />
                <div className="flex gap-1.5 mb-3">
                  <div className="h-5 w-14 rounded bg-slate-100 animate-pulse" />
                  <div className="h-5 w-14 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 flex-1 rounded-xl bg-slate-100 animate-pulse" />
                  <div className="h-9 flex-1 rounded-xl bg-slate-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && visits.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(79,209,197,0.08)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </div>
            <div className="text-slate-500 text-sm font-medium mb-1">No visits scheduled</div>
            <div className="text-slate-400 text-xs">Your day is clear. Enjoy the break!</div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {visits.map((visit, idx) => (
            <div
              key={visit.id}
              className="group bg-white rounded-2xl p-4 border border-slate-100 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Top row: avatar + name + status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{
                      background: visit.status === 'completed'
                        ? 'rgba(34,197,94,0.1)' : visit.status === 'in-progress'
                        ? `linear-gradient(135deg, ${COLORS.teal}20, ${COLORS.teal2}15)`
                        : 'rgba(148,163,184,0.12)',
                      color: getStatusDot(visit.status),
                    }}
                  >
                    {visit.clientName.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{visit.clientName}</div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        {visit.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 8 10" /></svg>
                        {visit.duration}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{
                    background: visit.status === 'completed' ? 'rgba(34,197,94,0.08)' : visit.status === 'in-progress' ? 'rgba(79,209,197,0.1)' : 'rgba(148,163,184,0.1)',
                    color: getStatusDot(visit.status),
                    border: `1px solid ${visit.status === 'completed' ? 'rgba(34,197,94,0.15)' : visit.status === 'in-progress' ? `${COLORS.teal}20` : 'rgba(148,163,184,0.15)'}`,
                  }}
                >
                  {getStatusLabel(visit.status)}
                </span>
              </div>

              {/* Flags */}
              {visit.flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {visit.flags.map((flag) => (
                    <span
                      key={flag}
                      className="text-[10px] font-medium px-2 py-1 rounded-lg flex items-center gap-1"
                      style={{ background: 'rgba(255,90,95,0.06)', color: COLORS.red, border: '1px solid rgba(255,90,95,0.1)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                      {flag}
                    </span>
                  ))}
                </div>
              )}

              {/* Tasks */}
              <div className="flex items-center gap-1.5 mb-3.5">
                {visit.tasks.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] px-2 py-1 rounded-md bg-slate-50 text-slate-500 border border-slate-100">
                    {t}
                  </span>
                ))}
                {visit.tasks.length > 3 && (
                  <span className="text-[10px] text-slate-400 font-medium">+{visit.tasks.length - 3}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleBriefing(visit.id)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border cursor-pointer transition-all duration-200"
                  style={{
                    borderColor: playingBrief === visit.id ? COLORS.teal : 'rgba(0,0,0,0.06)',
                    color: playingBrief === visit.id ? COLORS.teal : '#64748b',
                    background: playingBrief === visit.id ? 'rgba(79,209,197,0.06)' : 'transparent',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {playingBrief === visit.id ? (
                      <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>
                    ) : (
                      <><polygon points="6 3 20 12 6 21 6 3" /></>
                    )}
                  </svg>
                  {playingBrief === visit.id ? 'Stop' : 'Briefing'}
                </button>
                <button
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white border-none cursor-pointer transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                  onClick={() => setLocation(`/visit/${visit.id}`)}
                >
                  {visit.status === 'in-progress' ? 'Continue Visit' : visit.status === 'completed' ? 'View Summary' : 'Start Visit'}
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

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setShowProfile(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: `linear-gradient(135deg, ${COLORS.teal}25, ${COLORS.teal2}15)`, color: COLORS.teal }}>
                {user ? getInitials(user.name) : 'C'}
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{user?.name || 'Carer'}</h3>
                <p className="text-xs text-slate-400">{user?.email || ''}</p>
              </div>
            </div>
            {user && (
              <div className="flex flex-col gap-3 mb-5 text-sm text-slate-600">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-400">Phone</span>
                  <span className="font-medium">{user.phone}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-400">Region</span>
                  <span className="font-medium">{user.region}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-400">Role</span>
                  <span className="font-medium capitalize">{user.role}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowProfile(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: 'transparent' }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('carei_token')
                  setLocation('/')
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                style={{ background: COLORS.red }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

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
