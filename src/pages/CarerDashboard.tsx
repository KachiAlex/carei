import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'wouter'
import type { Visit } from '../data/clients'
import {
  getVisits,
  sendSOS,
  getMe,
  logoutUser,
  getCaregiverClients,
  getCaregiverTasks,
  startTask,
  completeTask,
  addTaskLog,
  getClientLogs,
} from '../api/client'
import { enqueue } from '../utils/offlineQueue'
import BiometricsPrompt from '../components/BiometricsPrompt'
import PullToRefresh from '../components/PullToRefresh'
import { TravelSummary } from '../components/TravelSummary'
import { sendVisitStartReminder, requestNotificationPermission } from '../utils/notifications'
import { triggerHaptic, HAPTIC_PATTERNS } from '../utils/haptic'
import { getToken, setToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  lavender: '#A78BFA',
  green: '#22C55E',
  g2: '#94A3B8',
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
  id?: string
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

// Helper to construct tenant-aware or legacy paths
function getPath(path: string): string {
  const saved = localStorage.getItem('carei_current_tenant')
  if (saved) {
    try {
      const t = JSON.parse(saved)
      if (t?.slug) return `/tenant/${t.slug}${path}`
    } catch { /* ignore */ }
  }
  return path
}

export default function CarerDashboard() {
  const [, setLocation] = useLocation()
  const [playingBrief, setPlayingBrief] = useState<string | null>(null)
  const [showSOSConfirm, setShowSOSConfirm] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [assignedClients, setAssignedClients] = useState<any[]>([])
  const [clientTasks, setClientTasks] = useState<Record<string, any[]>>({})
  const [activeTaskLog, setActiveTaskLog] = useState<{ logId: string; clientId: string; taskName: string; startTime: string } | null>(null)
  const [taskNotes, setTaskNotes] = useState('')
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [clientLogs, setClientLogs] = useState<any[]>([])
  const [showLogModal, setShowLogModal] = useState(false)
  const [logTaskName, setLogTaskName] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      let token = getToken()
      if (!token) {
        token = await secureGet('token')
        if (token) setToken(token)
      }
      if (!token) {
        setLocation('/login?redirect=/dashboard')
        return
      }
      getMe()
      .then((data) => { if (data.user) setUser(data.user) })
      .catch(() => {})
    })()
  }, [])

  const refreshData = async () => {
    setLoading(true)
    let token = getToken()
    if (!token) {
      token = await secureGet('token')
      if (token) setToken(token)
    }
    if (!token) {
      setLocation('/login?redirect=/dashboard')
      return
    }
    await Promise.all([
      getVisits().then((data) => {
        setVisits(data.visits || [])
        requestNotificationPermission().then(() => {
          const pending = (data.visits || []).filter((v: Visit) => v.status === 'pending')
          if (pending.length > 0) {
            sendVisitStartReminder(pending[0].clientName, pending[0].time)
          }
        })
      }).catch(() => {}),
      getCaregiverClients().then((data) => {
        const clients = data.clients || []
        setAssignedClients(clients)
        clients.forEach((client: any) => {
          getCaregiverTasks(client.id)
            .then((res) => {
              setClientTasks((prev) => ({ ...prev, [client.id]: res.tasks || [] }))
            })
            .catch(() => {})
        })
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => {
    refreshData()
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

  const nextVisit = useMemo(() => visits.find((v) => v.status === 'pending'), [visits])

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
    triggerHaptic(HAPTIC_PATTERNS.sos)
    setShowSOSConfirm(true)
    setTimeout(() => setShowSOSConfirm(false), 15000)
  }

  const confirmSOS = async () => {
    setShowSOSConfirm(false)
    triggerHaptic(HAPTIC_PATTERNS.sos)

    const getLocation = (): Promise<{ lat?: number; lng?: number }> => new Promise((resolve) => {
      if (!navigator.geolocation) { resolve({}); return }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      )
    })

    const loc = await getLocation()
    const locationStr = loc.lat !== undefined
      ? `https://maps.google.com/?q=${loc.lat},${loc.lng} (lat: ${loc.lat.toFixed(5)}, lng: ${loc.lng?.toFixed(5)})`
      : 'Carer Dashboard — location unavailable'

    const payload = { visitId: 'dashboard', location: locationStr, timestamp: new Date().toISOString(), coordinates: loc.lat !== undefined ? { lat: loc.lat, lng: loc.lng } : undefined }
    try {
      if (!navigator.onLine) {
        await enqueue({ type: 'sos', payload })
        alert('SOS Alert queued — will send when back online.')
      } else {
        await sendSOS(payload)
        alert('SOS Alert Sent! Supervisor notified.')
      }
    } catch {
      alert('Failed to send SOS. Please retry.')
    }
  }

  const handleStartTask = async (clientId: string, taskName: string) => {
    try {
      const res = await startTask({ clientId, taskName })
      setActiveTaskLog({ logId: res.id, clientId, taskName, startTime: res.startTime })
    } catch (err: any) {
      alert(err.message || 'Failed to start task')
    }
  }

  const handleCompleteTask = async () => {
    if (!activeTaskLog) return
    try {
      await completeTask({ logId: activeTaskLog.logId, notes: taskNotes })
      setActiveTaskLog(null)
      setTaskNotes('')
      // Refresh logs
      if (selectedClient) {
        const res = await getClientLogs(selectedClient)
        setClientLogs(res.logs || [])
      }
    } catch (err: any) {
      alert(err.message || 'Failed to complete task')
    }
  }

  const handleAddLog = async () => {
    if (!selectedClient || !logTaskName) return
    try {
      await addTaskLog({ clientId: selectedClient, taskName: logTaskName, notes: logNotes })
      setShowLogModal(false)
      setLogTaskName('')
      setLogNotes('')
      const res = await getClientLogs(selectedClient)
      setClientLogs(res.logs || [])
    } catch (err: any) {
      alert(err.message || 'Failed to add log')
    }
  }

  const handleSelectClient = async (clientId: string) => {
    setSelectedClient(clientId)
    try {
      const res = await getClientLogs(clientId)
      setClientLogs(res.logs || [])
    } catch { setClientLogs([]) }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative items-center">
      <div className="w-full max-w-3xl flex flex-col min-h-screen relative pb-20" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <div
        className="px-6 pt-5 pb-6 text-white shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        {/* Subtle animated glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none" style={{ background: COLORS.teal }} />

        <div className="relative z-10 flex items-center justify-between mb-5">
          <motion.button
            whileTap={{ scale: 0.97 }}
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
          </motion.button>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setLocation(getPath('/copilot'))}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target"
              title="AI Copilot"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
              </svg>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={async () => {
                await logoutUser()
                setLocation('/')
              }}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target"
              title="Log out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </motion.button>
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
      <PullToRefresh onRefresh={refreshData}>
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

        {!loading && visits.length >= 2 && user?.id && (
          <div className="mb-4">
            <TravelSummary
              visits={visits}
              assignedClients={assignedClients}
              carerId={user.id}
              visitDate={new Date().toISOString().split('T')[0]}
            />
          </div>
        )}

        {!loading && nextVisit && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-4 rounded-2xl p-4 border"
            style={{ background: `linear-gradient(135deg, ${COLORS.darkNavy}, ${COLORS.navy})`, borderColor: `${COLORS.teal}30` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Up Next</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/70">{nextVisit.time}</span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(79,209,197,0.2)', color: COLORS.teal }}>
                {nextVisit.clientName.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div>
                <div className="font-bold text-sm text-white">{nextVisit.clientName}</div>
                <div className="text-[11px] text-white/50">{nextVisit.duration} &middot; {nextVisit.tasks.slice(0, 2).join(', ')}{nextVisit.tasks.length > 2 ? '...' : ''}</div>
              </div>
            </div>
            <button
              onClick={() => setLocation(getPath(`/client/${nextVisit.clientId}/overview`))}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
            >
              Start Visit
            </button>
          </motion.div>
        )}

        <motion.div
          className="flex flex-col gap-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
        >
          {visits.map((visit, idx) => (
            <motion.div
              key={visit.id}
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.3 }}
              className="group bg-white rounded-2xl p-4 border border-slate-100 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              {/* Top row: emoji avatar + name + time pill + status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {/* Emoji Avatar */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
                    style={{
                      background: visit.status === 'completed'
                        ? 'rgba(34,197,94,0.1)' : visit.status === 'in-progress'
                        ? `linear-gradient(135deg, ${COLORS.teal}20, ${COLORS.teal2}15)`
                        : 'rgba(148,163,184,0.12)',
                      border: `2px solid ${visit.status === 'completed' ? 'rgba(34,197,94,0.2)' : visit.status === 'in-progress' ? COLORS.teal : 'rgba(148,163,184,0.3)'}`,
                    }}
                  >
                    {'👤'}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{visit.clientName}</div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span 
                        className="px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(79,209,197,0.1)', color: COLORS.teal }}
                      >
                        {visit.time}
                      </span>
                      <span>{visit.duration}</span>
                    </div>
                  </div>
                </div>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{
                    background: visit.status === 'completed' ? 'rgba(34,197,94,0.08)' : visit.status === 'in-progress' ? 'rgba(79,209,197,0.1)' : visit.status === 'missed' ? 'rgba(255,90,95,0.1)' : 'rgba(148,163,184,0.1)',
                    color: getStatusDot(visit.status),
                    border: `1px solid ${visit.status === 'completed' ? 'rgba(34,197,94,0.15)' : visit.status === 'in-progress' ? `${COLORS.teal}20` : visit.status === 'missed' ? 'rgba(255,90,95,0.2)' : 'rgba(148,163,184,0.15)'}`,
                  }}
                >
                  {getStatusLabel(visit.status)}
                </span>
              </div>
              
              {/* 3 Handover Bullets with Emoji Tags */}
              <div className="mb-3 space-y-1.5">
                {(visit.flags?.slice(0, 3) || []).map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-600">
                    <span className="text-teal-500 mt-0.5">•</span>
                    <span>{bullet}</span>
                  </div>
                ))}
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
                  onClick={() => {
                    if (visit.status === 'pending') {
                      setLocation(getPath(`/client/${visit.clientId}/overview`))
                    } else if (visit.status === 'completed') {
                      setLocation(getPath(`/summary/${visit.id}`))
                    } else {
                      setLocation(getPath(`/visit/${visit.id}`))
                    }
                  }}
                >
                  {visit.status === 'in-progress' ? 'Continue Visit' : visit.status === 'completed' ? 'View Summary' : 'Start Visit'}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
      </PullToRefresh>

      {/* My Clients Section */}
      <div className="flex-1 px-4 py-5 overflow-auto border-t border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">My Clients</h2>
            <p className="text-[11px] text-slate-400">{assignedClients.length} assigned clients</p>
          </div>
        </div>

        {assignedClients.length === 0 && !loading && (
          <div className="text-center py-8">
            <div className="text-slate-400 text-sm">No clients assigned yet.</div>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-4">
          {assignedClients.map((client) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.teal}20, ${COLORS.teal2}15)`, color: COLORS.teal }}>
                    {client.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{client.name}</div>
                    <div className="text-[11px] text-slate-400">{client.age ? `${client.age} yrs · ` : ''}{client.address}</div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectClient(client.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer"
                  style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
                >
                  {selectedClient === client.id ? 'Hide' : 'Tasks'}
                </motion.button>
              </div>

              {selectedClient === client.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 pt-3 border-t border-slate-100">
                  {/* Tasks */}
                  <div className="flex flex-col gap-2 mb-3">
                    {(clientTasks[client.id] || []).map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between py-2 px-2 rounded-xl bg-slate-50">
                        <div className="text-sm text-slate-700">{task.name}</div>
                        {activeTaskLog && activeTaskLog.clientId === client.id && activeTaskLog.taskName === task.name ? (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setActiveTaskLog(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white border-none cursor-pointer"
                            style={{ background: COLORS.amber }}
                          >
                            In Progress
                          </motion.button>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleStartTask(client.id, task.name)}
                            disabled={!!activeTaskLog}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white border-none cursor-pointer disabled:opacity-40"
                            style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                          >
                            Start
                          </motion.button>
                        )}
                      </div>
                    ))}
                    {(clientTasks[client.id] || []).length === 0 && (
                      <div className="text-xs text-slate-400 py-2">No tasks assigned.</div>
                    )}
                  </div>

                  {/* Active task completion */}
                  {activeTaskLog && activeTaskLog.clientId === client.id && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="bg-teal-50 rounded-xl p-3 border border-teal-100 mb-3">
                      <div className="text-xs font-semibold text-teal-700 mb-1">Active: {activeTaskLog.taskName}</div>
                      <div className="text-[10px] text-teal-500 mb-2">Started {new Date(activeTaskLog.startTime).toLocaleTimeString()}</div>
                      <textarea
                        value={taskNotes}
                        onChange={(e) => setTaskNotes(e.target.value)}
                        placeholder="Add notes before completing..."
                        className="w-full bg-white rounded-lg px-2 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none resize-none border border-teal-100 mb-2"
                        rows={2}
                      />
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleCompleteTask}
                        className="w-full py-2 rounded-lg text-xs font-semibold text-white border-none cursor-pointer"
                        style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                      >
                        Complete Task
                      </motion.button>
                    </motion.div>
                  )}

                  {/* Add log button */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setShowLogModal(true); setLogTaskName(''); setLogNotes('') }}
                    className="w-full py-2 rounded-xl text-xs font-semibold border cursor-pointer mb-3"
                    style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
                  >
                    + Add Log Note
                  </motion.button>

                  {/* Recent logs */}
                  {clientLogs.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recent Logs</div>
                      {clientLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="bg-slate-50 rounded-lg p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-700">{log.taskName}</span>
                            {log.durationMinutes !== null && log.durationMinutes !== undefined && (
                              <span className="text-[10px] text-teal-600 font-medium">{log.durationMinutes}m</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {log.startTime && log.completeTime ? (
                              <span>{new Date(log.startTime).toLocaleTimeString()} — {new Date(log.completeTime).toLocaleTimeString()}</span>
                            ) : (
                              <span>{new Date(log.createdAt).toLocaleString()}</span>
                            )}
                          </div>
                          {log.notes && <div className="text-[10px] text-slate-500 mt-1">{log.notes}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Log Note Modal */}
      {showLogModal && selectedClient && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-5 max-w-sm w-full overscroll-y-contain" style={{ overscrollBehavior: 'contain' }}>
            <h3 className="font-bold text-slate-800 mb-3">Add Log Note</h3>
            <input
              value={logTaskName}
              onChange={(e) => setLogTaskName(e.target.value)}
              placeholder="Task name"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal mb-3"
            />
            <textarea
              value={logNotes}
              onChange={(e) => setLogNotes(e.target.value)}
              placeholder="Notes..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal resize-none mb-4"
              rows={3}
            />
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowLogModal(false)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>Cancel</motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAddLog} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white border-none cursor-pointer" style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}>Save Log</motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bottom Navigation - Today | Copilot | SOS | History | Profile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 pt-2 z-40" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors hover:bg-slate-50"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
            <span className="text-[10px] font-medium" style={{ color: COLORS.teal }}>Today</span>
          </button>
          
          <button 
            onClick={() => setLocation(getPath('/copilot'))}
            className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors hover:bg-slate-50"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.g2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
            </svg>
            <span className="text-[10px] font-medium text-slate-400">Copilot</span>
          </button>
          
          {/* SOS Button with pulse animation */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: COLORS.red }} />
            <div className="absolute -inset-1 rounded-full animate-pulse opacity-30" style={{ background: COLORS.red }} />
            <button
              onClick={handleSOS}
              className="relative w-12 h-12 rounded-full text-white font-bold text-xs shadow-lg cursor-pointer border-2 border-white flex items-center justify-center"
              style={{ background: COLORS.red, boxShadow: '0 4px 20px rgba(255,90,95,0.5)' }}
              aria-label="SOS Emergency"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </button>
          </div>
          
          <button 
            onClick={() => setLocation(getPath('/history'))}
            className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors hover:bg-slate-50"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.g2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>
            </svg>
            <span className="text-[10px] font-medium text-slate-400">History</span>
          </button>
          
          <button 
            onClick={() => setLocation(getPath('/settings'))}
            className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors hover:bg-slate-50"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.g2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span className="text-[10px] font-medium text-slate-400">Settings</span>
          </button>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setShowProfile(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full overscroll-y-contain" style={{ overscrollBehavior: 'contain' }} onClick={(e) => e.stopPropagation()}>
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
                onClick={async () => {
                  try { await logoutUser() } catch (err: any) { console.error('logout failed', err.message) }
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
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center overscroll-y-contain" style={{ overscrollBehavior: 'contain' }}>
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

      <BiometricsPrompt />
      </div>
    </div>
  )
}
