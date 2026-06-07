import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'wouter'
import {
  getManagerData,
  createCaregiver,
  getClients,
  createClient,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getManagerTasks,
  createManagerTask,
  deleteManagerTask,
  getClientLogs,
} from '../api/client'
import { sendSOSAlert, sendSOSResolved, requestNotificationPermission } from '../utils/notifications'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  amber: '#F6B73C',
  red: '#FF5A5F',
  lavender: '#A78BFA',
}

export default function ManagerDashboard() {
  const [, setLocation] = useLocation()
  const [tab, setTab] = useState<'overview' | 'carers' | 'mar' | 'incidents' | 'staff' | 'clients' | 'assignments' | 'logs'>('overview')
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const [liveIncidents, setLiveIncidents] = useState<any[]>([])
  const [sseConnected, setSseConnected] = useState(false)
  const [dbCarers, setDbCarers] = useState<any[]>([])
  const [dbVisits, setDbVisits] = useState<any[]>([])
  const [dbAlerts, setDbAlerts] = useState<any[]>([])
  const [dbIncidents, setDbIncidents] = useState<any[]>([])
  const [dbMedications, setDbMedications] = useState<any[]>([])
  const [dbClients, setDbClients] = useState<any[]>([])
  const [dbAssignments, setDbAssignments] = useState<any[]>([])
  const [dbTasks, setDbTasks] = useState<any[]>([])
  const [dbLogs, setDbLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [logClientId, setLogClientId] = useState<string>('')

  useEffect(() => {
    getManagerData()
      .then((data) => {
        setDbCarers(data.carers || [])
        setDbVisits(data.visits || [])
        setDbAlerts(data.alerts || [])
        setDbIncidents(data.incidents || [])
        setDbMedications(data.medications || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const eventSource = new EventSource('/api/events')
    eventSource.onopen = () => setSseConnected(true)
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'sos') {
          setLiveIncidents((prev) => [
            {
              id: data.alertId,
              carer: data.visitId || 'Unknown visit',
              client: data.location || 'Unknown location',
              type: 'SOS alert (live)',
              time: new Date(data.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              severity: 'high' as const,
            },
            ...prev,
          ])
          requestNotificationPermission().then(() => {
            sendSOSAlert(data.location || 'Unknown location')
          })
        }
      } catch {}
    }
    eventSource.onerror = () => setSseConnected(false)
    return () => { eventSource.close() }
  }, [])

  const allIncidents = [
    ...dbAlerts.map((a: any) => ({
      id: a.id,
      carer: a.visit_id || 'Unknown',
      client: a.location || 'Unknown',
      type: 'SOS Alert',
      time: new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      severity: 'high' as const,
    })),
    ...dbIncidents.map((i: any) => ({
      id: i.id,
      carer: i.carer_name || 'Unknown',
      client: i.client_name || 'Unknown',
      type: i.type,
      time: new Date(i.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      severity: (i.severity || 'medium') as 'high' | 'medium',
    })),
    ...liveIncidents,
  ].filter((inc) => !resolvedIds.has(inc.id))

  const stats = useMemo(() => {
    const total = dbVisits.length
    const completed = dbVisits.filter((v: any) => v.status === 'completed').length
    const inProgress = dbVisits.filter((v: any) => v.status === 'in-progress').length
    const pending = dbVisits.filter((v: any) => v.status === 'pending').length
    const medConfirmed = dbMedications.filter((m: any) => m.status === 'confirmed').length
    const medSkipped = dbMedications.filter((m: any) => m.status === 'skipped').length
    return { total, completed, inProgress, pending, medConfirmed, medSkipped }
  }, [dbVisits, dbMedications])

  const highSeverityCount = allIncidents.filter((i) => i.severity === 'high').length

  const cardVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.98 },
    visible: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const } }),
  }

  const renderSkeleton = () => (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.35 }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
        >
          <div className="h-4 w-32 rounded bg-slate-100 animate-pulse mb-3" />
          <div className="h-8 w-full rounded bg-slate-100 animate-pulse mb-3" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 rounded bg-slate-100 animate-pulse" />
            <div className="h-10 rounded bg-slate-100 animate-pulse" />
            <div className="h-10 rounded bg-slate-100 animate-pulse" />
          </div>
        </motion.div>
      ))}
    </div>
  )

  const renderOverview = () => (
    <motion.div className="flex flex-col gap-3" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
      {/* Completion Rate */}
      <motion.div custom={0} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-800">Today's Completion</h3>
            <p className="text-[11px] text-slate-400">{stats.completed} of {stats.total} visits completed</p>
          </div>
          <div className="text-lg font-bold" style={{ color: COLORS.teal }}>
            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`,
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Completed', value: stats.completed, color: COLORS.teal },
            { label: 'In Progress', value: stats.inProgress, color: COLORS.amber },
            { label: 'Pending', value: stats.pending, color: '#94a3b8' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-base font-bold text-slate-800">{s.value}</div>
              <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Weekly Visit Chart */}
      <motion.div custom={1} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <h3 className="font-bold text-sm text-slate-800 mb-3">Weekly Visits</h3>
        <div className="flex items-end gap-2 h-24">
          {[
            { day: 'Mon', value: 8 },
            { day: 'Tue', value: 12 },
            { day: 'Wed', value: 10 },
            { day: 'Thu', value: 14 },
            { day: 'Fri', value: stats.total || 6 },
            { day: 'Sat', value: 4 },
            { day: 'Sun', value: 3 },
          ].map((d, idx) => (
            <motion.div
              key={d.day}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.3 + idx * 0.05, duration: 0.5, ease: 'easeOut' }}
              className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer origin-bottom"
            >
              <div className="w-full relative rounded-lg overflow-hidden transition-all duration-300 group-hover:brightness-110" style={{ height: `${(d.value / 16) * 100}%`, minHeight: 8 }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: '100%' }}
                  transition={{ delay: 0.3 + idx * 0.05, duration: 0.6, ease: 'easeOut' }}
                  className="absolute bottom-0 left-0 right-0 rounded-lg"
                  style={{
                    background: d.day === 'Fri' ? `linear-gradient(180deg, ${COLORS.teal}, ${COLORS.teal2})` : 'linear-gradient(180deg, #e2e8f0, #cbd5e1)',
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium group-hover:text-slate-600 transition-colors">{d.day}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Visits Today', value: stats.total, sub: `${stats.completed} done · ${stats.inProgress} active`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> },
          { label: 'Medications', value: `${stats.medConfirmed}/${Math.max(dbMedications.length, 1)}`, sub: `${stats.medSkipped} skipped`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 11-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3l8.5 8.5 8-8Z"/></svg> },
          { label: 'Carers On Duty', value: dbCarers.length, sub: `${dbCarers.filter((c: any) => c.status === 'in-visit').length} in visit · ${dbCarers.filter((c: any) => c.status === 'traveling').length} traveling`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          { label: 'Alerts', value: `${allIncidents.length}`, sub: `${highSeverityCount} high · ${allIncidents.length - highSeverityCount} medium`, alert: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg> },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            custom={i + 3}
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm cursor-default"
          >
            <div className="flex items-center gap-1.5 text-slate-300 mb-1.5">{s.icon}<span className="text-[10px] text-slate-400 uppercase tracking-wider">{s.label}</span></div>
            <div className="text-xl font-bold text-slate-800">{s.value}</div>
            <div className={`text-[10px] ${s.alert ? 'text-red-400' : 'text-slate-400'}`}>{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Live Carer Status */}
      <motion.div custom={7} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-800">Live Carer Status</h3>
          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: COLORS.teal }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.teal }} />
            Live
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {dbCarers.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 text-slate-400 text-sm">No carers on duty</motion.div>
          )}
          {dbCarers.map((carer: any, idx: number) => (
            <motion.div
              key={carer.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + idx * 0.06, duration: 0.3 }}
              whileHover={{ x: 4, backgroundColor: 'rgba(248,250,252,1)' }}
              className="flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-default"
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.darkNavy})` }}>
                {carer.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{carer.name}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      background: carer.status === 'in-visit' ? 'rgba(79,209,197,0.1)' : carer.status === 'traveling' ? 'rgba(246,183,60,0.1)' : '#f1f5f9',
                      color: carer.status === 'in-visit' ? COLORS.teal : carer.status === 'traveling' ? COLORS.amber : '#94a3b8',
                      border: `1px solid ${carer.status === 'in-visit' ? 'rgba(79,209,197,0.15)' : carer.status === 'traveling' ? 'rgba(246,183,60,0.15)' : 'transparent'}`,
                    }}
                  >
                    {carer.status.replace('-', ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {carer.client ? `${carer.client} · ${carer.location}` : carer.location}
                </div>
              </div>
              <div className="text-xs text-slate-400 shrink-0 font-mono">{carer.since}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent Incidents */}
      {allIncidents.length > 0 && (
        <motion.div custom={8} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Recent Alerts</h3>
          <div className="flex flex-col gap-2">
            {allIncidents.slice(0, 5).map((inc, idx) => (
              <motion.button
                key={inc.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.05, duration: 0.3 }}
                whileHover={{ scale: 1.01, backgroundColor: 'rgba(0,0,0,0.04)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedIncident(inc.id)}
                className="flex items-center gap-3 text-left p-3 rounded-xl cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(0,0,0,0.02)' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: inc.severity === 'high' ? 'rgba(255,90,95,0.1)' : 'rgba(246,183,60,0.1)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inc.severity === 'high' ? COLORS.red : COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{inc.type}</div>
                  <div className="text-xs text-slate-400">{inc.carer} · {inc.client}</div>
                </div>
                <div className="text-xs text-slate-400 shrink-0 font-mono">{inc.time}</div>
              </motion.button>
            ))}
          </div>
          {allIncidents.length > 5 && (
            <motion.button
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setTab('incidents')}
              className="w-full mt-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-transparent border-none cursor-pointer"
            >
              View all {allIncidents.length} alerts →
            </motion.button>
          )}
        </motion.div>
      )}
    </motion.div>
  )

  const renderCarers = () => (
    <motion.div className="flex flex-col gap-3" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
      {dbCarers.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
          <div className="text-slate-500 text-sm font-medium mb-1">No carers found</div>
          <div className="text-slate-400 text-xs">Add carers in the admin panel.</div>
        </motion.div>
      )}
      {dbCarers.map((carer: any, idx: number) => (
        <motion.div
          key={carer.id}
          custom={idx}
          variants={cardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm cursor-default"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.darkNavy})` }}>
              {carer.avatar}
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm text-slate-800">{carer.name}</div>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: carer.status === 'in-visit' ? 'rgba(79,209,197,0.1)' : carer.status === 'traveling' ? 'rgba(246,183,60,0.1)' : '#f1f5f9',
                  color: carer.status === 'in-visit' ? COLORS.teal : carer.status === 'traveling' ? COLORS.amber : '#94a3b8',
                  border: `1px solid ${carer.status === 'in-visit' ? 'rgba(79,209,197,0.15)' : carer.status === 'traveling' ? 'rgba(246,183,60,0.15)' : 'transparent'}`,
                }}
              >
                {carer.status.replace('-', ' ')}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="text-slate-700">{carer.location}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span className="text-slate-700">{carer.client || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className="text-slate-700">{carer.since}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              <span className="text-slate-700">3 visits</span>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )

  const renderMAR = () => {
    const confirmed = dbMedications.filter((m: any) => m.status === 'confirmed').length
    const skipped = dbMedications.filter((m: any) => m.status === 'skipped').length
    const pending = dbMedications.filter((m: any) => m.status === 'pending').length
    const medCount = dbMedications.length
    return (
      <motion.div className="flex flex-col gap-3" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
        {/* MAR Summary */}
        <motion.div custom={0} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-800">MAR Summary</h3>
            <span className="text-xs text-slate-400 font-mono">{new Date().toLocaleDateString('en-GB')}</span>
          </div>
          {medCount > 0 ? (
            <div className="flex items-center justify-center mb-3 relative">
              <svg width="100" height="100" viewBox="0 0 100 100" className="transform -rotate-90">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="38" fill="none"
                  stroke={COLORS.teal}
                  strokeWidth="10"
                  strokeDasharray={`${(confirmed / medCount) * 239} 239`}
                  strokeLinecap="round"
                />
                <circle
                  cx="50" cy="50" r="38" fill="none"
                  stroke={COLORS.red}
                  strokeWidth="10"
                  strokeDasharray={`${(skipped / medCount) * 239} 239`}
                  strokeDashoffset={`-${(confirmed / medCount) * 239}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-xl font-bold text-slate-800">{confirmed}</div>
                <div className="text-[10px] text-slate-400">of {medCount}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-sm">No medications logged today</div>
          )}
          <div className="flex justify-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS.teal }} />
              <span className="text-[10px] text-slate-500">{confirmed} Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS.red }} />
              <span className="text-[10px] text-slate-500">{skipped} Skipped</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: '#cbd5e1' }} />
              <span className="text-[10px] text-slate-500">{pending} Pending</span>
            </div>
          </div>
        </motion.div>

        {/* Medication List */}
        <motion.div custom={1} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Medication Log</h3>
          {dbMedications.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 text-slate-400 text-sm">No medication records</motion.div>
          )}
          <div className="flex flex-col gap-2">
            {dbMedications.map((med: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.04, duration: 0.3 }}
                whileHover={{ scale: 1.01, backgroundColor: med.status === 'skipped' ? 'rgba(255,90,95,0.05)' : 'rgba(248,250,252,1)' }}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-50 cursor-default"
                style={{ background: med.status === 'skipped' ? 'rgba(255,90,95,0.03)' : 'white' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-700">{med.medication_name}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: med.status === 'confirmed' ? 'rgba(79,209,197,0.1)' : med.status === 'skipped' ? 'rgba(255,90,95,0.08)' : '#f1f5f9',
                        color: med.status === 'confirmed' ? COLORS.teal : med.status === 'skipped' ? COLORS.red : '#94a3b8',
                        border: `1px solid ${med.status === 'confirmed' ? 'rgba(79,209,197,0.15)' : med.status === 'skipped' ? 'rgba(255,90,95,0.1)' : 'transparent'}`,
                      }}
                    >
                      {med.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{med.client_name} · {med.scheduled_time} · {med.carer_name}</div>
                  {med.reason && <div className="text-[10px] mt-0.5" style={{ color: COLORS.red }}>Reason: {med.reason}</div>}
                </div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: med.status === 'confirmed' ? 'rgba(79,209,197,0.1)' : med.status === 'skipped' ? 'rgba(255,90,95,0.1)' : 'rgba(0,0,0,0.03)' }}>
                  {med.status === 'confirmed' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                  {med.status === 'skipped' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  )}
                  {med.status === 'pending' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    )
  }

  const renderIncidents = () => (
    <motion.div className="flex flex-col gap-3" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
      {allIncidents.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
          <div className="text-slate-500 text-sm font-medium mb-1">No incidents reported</div>
          <div className="text-slate-400 text-xs">Everything is running smoothly.</div>
        </motion.div>
      )}
      {allIncidents.map((inc, idx) => (
        <motion.div
          key={inc.id}
          custom={idx}
          variants={cardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm cursor-default"
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: inc.severity === 'high' ? 'rgba(255,90,95,0.1)' : 'rgba(246,183,60,0.1)',
                color: inc.severity === 'high' ? COLORS.red : COLORS.amber,
                border: `1px solid ${inc.severity === 'high' ? 'rgba(255,90,95,0.15)' : 'rgba(246,183,60,0.15)'}`,
              }}
            >
              {inc.severity === 'high' ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              )}
              {inc.severity.toUpperCase()}
            </div>
            <span className="text-xs text-slate-400 font-mono">{inc.time}</span>
          </div>
          <div className="font-bold text-sm text-slate-800 mb-1">{inc.type}</div>
          <div className="text-xs text-slate-500 mb-3 flex flex-col gap-0.5">
            <div className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> {inc.carer}</div>
            <div className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> {inc.client}</div>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.97 }} className="flex-1 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all hover:bg-slate-50" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>Review</motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setResolvedIds((prev) => new Set([...prev, inc.id]))
                sendSOSResolved(inc.client)
              }}
              className="flex-1 py-2 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all hover:opacity-90 text-white"
              style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
            >Resolve</motion.button>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )

  function renderStaff() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [region, setRegion] = useState('')
    const [pin, setPin] = useState('')
    const [role, setRole] = useState('carer')
    const [msg, setMsg] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        await createCaregiver({ name, email, phone, region, pin, role })
        setMsg('Caregiver created successfully')
        setName(''); setEmail(''); setPhone(''); setRegion(''); setPin('')
      } catch (err: any) {
        setMsg(err.message || 'Failed to create caregiver')
      }
    }

    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-slate-800">Create Caregiver</h2>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
          <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN (4-6 digits)" type="password" maxLength={6} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white">
            <option value="carer">Carer</option>
            <option value="manager">Manager</option>
          </select>
          <motion.button whileTap={{ scale: 0.97 }} type="submit" className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>Create Caregiver</motion.button>
          {msg && <div className="text-xs text-slate-500">{msg}</div>}
        </form>
      </div>
    )
  }

  function renderClients() {
    const [name, setName] = useState('')
    const [age, setAge] = useState('')
    const [address, setAddress] = useState('')
    const [conditions, setConditions] = useState('')
    const [medications, setMedications] = useState('')
    const [preferences, setPreferences] = useState('')
    const [emergencyContact, setEmergencyContact] = useState('')
    const [msg, setMsg] = useState('')
    const [clientsList, setClientsList] = useState<any[]>([])

    useEffect(() => {
      getClients().then((rows) => setClientsList(rows)).catch(() => {})
    }, [msg])

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        const id = 'cl-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
        await createClient({
          id,
          name,
          age: age ? parseInt(age) : undefined,
          address: address || undefined,
          conditions: conditions.split(',').map((s) => s.trim()).filter(Boolean),
          medications: medications.split(',').map((s) => {
            const parts = s.trim().split('—')
            return { name: parts[0] || s.trim(), dose: parts[1] || '-', frequency: parts[2] || 'daily' }
          }).filter((m) => m.name),
          preferences: preferences || undefined,
          emergencyContact: emergencyContact || undefined,
        })
        setMsg('Client created successfully')
        setName(''); setAge(''); setAddress(''); setConditions(''); setMedications(''); setPreferences(''); setEmergencyContact('')
      } catch (err: any) {
        setMsg(err.message || 'Failed to create client')
      }
    }

    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-slate-800">Create Client</h2>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
          <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" type="number" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
          <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Conditions (comma separated)" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
          <input value={medications} onChange={(e) => setMedications(e.target.value)} placeholder="Medications: Name—Dose—Frequency (comma separated)" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
          <input value={preferences} onChange={(e) => setPreferences(e.target.value)} placeholder="Care preferences" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
          <input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Emergency contact" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
          <motion.button whileTap={{ scale: 0.97 }} type="submit" className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>Create Client</motion.button>
          {msg && <div className="text-xs text-slate-500">{msg}</div>}
        </form>
        <h3 className="font-bold text-slate-800 mt-2">Existing Clients</h3>
        <div className="flex flex-col gap-2">
          {clientsList.map((c) => (
            <div key={c.id} className="bg-white rounded-xl p-3 border border-slate-200 text-sm">
              <div className="font-semibold text-slate-700">{c.name}</div>
              <div className="text-xs text-slate-400">{c.age ? `${c.age} yrs · ` : ''}{c.address}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderAssignments() {
    const [caregiverId, setCaregiverId] = useState('')
    const [clientId, setClientId] = useState('')
    const [msg, setMsg] = useState('')
    const [assignmentsList, setAssignmentsList] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [clients, setClients] = useState<any[]>([])

    useEffect(() => {
      getAssignments().then((res) => setAssignmentsList(res.assignments || [])).catch(() => {})
      getClients().then((rows) => setClients(rows)).catch(() => {})
    }, [msg])

    useEffect(() => {
      // Load users (caregivers) from dbCarers or fetch separately
      fetch('/api/carers', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => setUsers(data.carers || []))
        .catch(() => {})
    }, [])

    const handleAssign = async () => {
      if (!caregiverId || !clientId) { setMsg('Select both caregiver and client'); return }
      try {
        await createAssignment({ caregiverId, clientId })
        setMsg('Assigned successfully')
        setCaregiverId(''); setClientId('')
        const res = await getAssignments()
        setAssignmentsList(res.assignments || [])
      } catch (err: any) {
        setMsg(err.message || 'Failed to assign')
      }
    }

    const handleUnassign = async (cgId: string, clId: string) => {
      try {
        await deleteAssignment(cgId, clId)
        setMsg('Unassigned successfully')
        const res = await getAssignments()
        setAssignmentsList(res.assignments || [])
      } catch (err: any) {
        setMsg(err.message || 'Failed to unassign')
      }
    }

    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-slate-800">Assign Client to Caregiver</h2>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col gap-3">
          <select value={caregiverId} onChange={(e) => setCaregiverId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white">
            <option value="">Select caregiver</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white">
            <option value="">Select client</option>
            {clients.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleAssign} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>Assign</motion.button>
          {msg && <div className="text-xs text-slate-500">{msg}</div>}
        </div>
        <h3 className="font-bold text-slate-800 mt-2">Current Assignments</h3>
        <div className="flex flex-col gap-2">
          {assignmentsList.map((a) => (
            <div key={a.id} className="bg-white rounded-xl p-3 border border-slate-200 text-sm flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-700">{a.clientName}</div>
                <div className="text-xs text-slate-400">Caregiver: {a.caregiverName}</div>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleUnassign(a.caregiverId, a.clientId)} className="px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>Unassign</motion.button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderLogs() {
    const [clients, setClients] = useState<any[]>([])
    const [logs, setLogs] = useState<any[]>([])
    const [selectedClient, setSelectedClient] = useState('')

    useEffect(() => {
      getClients().then((rows) => setClients(rows)).catch(() => {})
    }, [])

    const handleFetchLogs = async (clientId: string) => {
      setSelectedClient(clientId)
      try {
        const res = await getClientLogs(clientId)
        setLogs(res.logs || [])
      } catch { setLogs([]) }
    }

    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-slate-800">Client Care Logs</h2>
        <select
          value={selectedClient}
          onChange={(e) => handleFetchLogs(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white"
        >
          <option value="">Select a client to view logs</option>
          {clients.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selectedClient && (
          <div className="flex flex-col gap-2">
            {logs.length === 0 && <div className="text-sm text-slate-400">No logs found for this client.</div>}
            {logs.map((log) => (
              <motion.div key={log.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-3 border border-slate-200 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-700">{log.taskName}</div>
                  {log.durationMinutes !== null && log.durationMinutes !== undefined && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-600">{log.durationMinutes} min</span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {log.startTime && <span>Started: {new Date(log.startTime).toLocaleString()} · </span>}
                  {log.completeTime && <span>Completed: {new Date(log.completeTime).toLocaleString()}</span>}
                  {!log.startTime && <span>Logged: {new Date(log.createdAt).toLocaleString()}</span>}
                </div>
                {log.notes && <div className="text-xs text-slate-500 mt-1 bg-slate-50 rounded-lg p-2">{log.notes}</div>}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans items-center">
      <div className="w-full max-w-3xl flex flex-col min-h-screen">
      {/* Header */}
      <div
        className="px-6 pt-5 pb-5 text-white shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-15 pointer-events-none" style={{ background: COLORS.teal }} />
        <div className="relative z-10 flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.teal}20, ${COLORS.teal2}15)` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold">Manager</div>
              <div className="text-[11px] text-white/40">Operations Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium" style={{ background: sseConnected ? 'rgba(79,209,197,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${sseConnected ? 'rgba(79,209,197,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: sseConnected ? COLORS.teal : '#94a3b8' }} />
              <span style={{ color: sseConnected ? COLORS.teal : '#94a3b8' }}>{sseConnected ? 'Live' : 'Offline'}</span>
            </span>
            <button
              onClick={() => setLocation('/manager/clients')}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target"
              title="Client Management"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button
              onClick={() => setLocation('/manager/schedule')}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target"
              title="Visit Scheduling"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </button>
            <button
              onClick={() => setLocation('/manager/login')}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target"
              title="Log out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-100 shrink-0 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {[
            { key: 'overview' as const, label: 'Overview' },
            { key: 'carers' as const, label: 'Carers' },
            { key: 'mar' as const, label: 'MAR' },
            { key: 'incidents' as const, label: 'Alerts' },
            { key: 'staff' as const, label: 'Staff' },
            { key: 'clients' as const, label: 'Clients' },
            { key: 'assignments' as const, label: 'Assign' },
            { key: 'logs' as const, label: 'Logs' },
          ].map((t) => (
            <motion.button
              key={t.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all duration-200"
              style={{
                background: tab === t.key ? COLORS.darkNavy : 'transparent',
                color: tab === t.key ? 'white' : '#64748b',
                boxShadow: tab === t.key ? '0 2px 8px rgba(11,17,32,0.15)' : 'none',
              }}
            >
              {t.label}
              {t.key === 'incidents' && allIncidents.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: COLORS.red, color: 'white' }}>{allIncidents.length}</span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <motion.div
        className="flex-1 px-4 py-4 overflow-auto"
        key={tab}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        {loading && renderSkeleton()}
        {!loading && tab === 'overview' && renderOverview()}
        {!loading && tab === 'carers' && renderCarers()}
        {!loading && tab === 'mar' && renderMAR()}
        {!loading && tab === 'incidents' && renderIncidents()}
        {!loading && tab === 'staff' && renderStaff()}
        {!loading && tab === 'clients' && renderClients()}
        {!loading && tab === 'assignments' && renderAssignments()}
        {!loading && tab === 'logs' && renderLogs()}
      </motion.div>
      </div>
    </div>
  )
}
