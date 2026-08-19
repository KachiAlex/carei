import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'wouter'
import { useTenant } from '../contexts/TenantContext'
import {
  getManagerData,
  getManagerOverview,
  createCaregiver,
  getClients,
  createClient,
  updateClient,
  deleteClient,
  fetchClient,
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getManagerTasks,
  createManagerTask,
  deleteManagerTask,
  getClientLogs,
  updateCaregiverStatus,
  deleteCaregiver,
  logoutUser,
  exportAgencyDataUrl,
  deleteAgencyData,
} from '../api/client'
import { clearAuthCache } from '../utils/tokenCache'
import { sendSOSAlert, sendSOSResolved, requestNotificationPermission } from '../utils/notifications'
import { exportVisits, exportCarers, exportClients } from '../utils/exportCsv'
import BiometricsPrompt from '../components/BiometricsPrompt'
import FamilyMemberInvitation from '../components/FamilyMemberInvitation'

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
  const { currentTenant } = useTenant()
  const tenantSlug = currentTenant?.slug || ''
  const [tab, setTab] = useState<'overview' | 'team' | 'clients' | 'schedule' | 'logs'>('overview')
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const [liveIncidents, setLiveIncidents] = useState<any[]>([])
  const [sseConnected, setSseConnected] = useState(false)
  const [dbCarers, setDbCarers] = useState<any[]>([])
  const [dbVisits, setDbVisits] = useState<any[]>([])
  const [dbAlerts, setDbAlerts] = useState<any[]>([])
  const [dbIncidents, setDbIncidents] = useState<any[]>([])
  const [dbMedications, setDbMedications] = useState<any[]>([])
  const [dbAssignments, setDbAssignments] = useState<any[]>([])
  const [dbTasks, setDbTasks] = useState<any[]>([])
  const [dbLogs, setDbLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [logClientId, setLogClientId] = useState<string>('')
  const [overview, setOverview] = useState<any>(null)

  // Team tab state
  const [teamShowAdd, setTeamShowAdd] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamEmail, setTeamEmail] = useState('')
  const [teamPhone, setTeamPhone] = useState('')
  const [teamRegion, setTeamRegion] = useState('')
  const [teamPin, setTeamPin] = useState('')
  const [teamRole, setTeamRole] = useState('carer')
  const [teamMsg, setTeamMsg] = useState('')

  // Clients tab state
  const [clientShowAdd, setClientShowAdd] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientAge, setClientAge] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientConditions, setClientConditions] = useState('')
  const [clientMedications, setClientMedications] = useState('')
  const [clientPreferences, setClientPreferences] = useState('')
  const [clientEmergency, setClientEmergency] = useState('')
  const [clientMsg, setClientMsg] = useState('')
  const [clientsList, setClientsList] = useState<any[]>([])

  // Schedule tab state
  const [scheduleCaregiverId, setScheduleCaregiverId] = useState('')
  const [scheduleClientId, setScheduleClientId] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleInstructions, setScheduleInstructions] = useState('')
  const [scheduleMsg, setScheduleMsg] = useState('')
  const [assignmentsList, setAssignmentsList] = useState<any[]>([])
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null)
  const [editAssignDate, setEditAssignDate] = useState('')
  const [editAssignTime, setEditAssignTime] = useState('')
  const [editAssignInstructions, setEditAssignInstructions] = useState('')

  // Logs tab state
  const [logsList, setLogsList] = useState<any[]>([])
  const [logsSelectedClient, setLogsSelectedClient] = useState('')

  // Modal state
  const [selectedCarer, setSelectedCarer] = useState<any>(null)
  const [showCarerModal, setShowCarerModal] = useState(false)
  const [carerActionMsg, setCarerActionMsg] = useState('')
  const [selectedClientDetail, setSelectedClientDetail] = useState<any>(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [clientActionMsg, setClientActionMsg] = useState('')
  const [showFamilyInvite, setShowFamilyInvite] = useState(false)

  const refreshManagerData = () => {
    getManagerData()
      .then((data) => {
        setDbCarers(data.carers || [])
        setDbVisits(data.visits || [])
        setDbAlerts(data.alerts || [])
        setDbIncidents(data.incidents || [])
        setDbMedications(data.medications || [])
      })
      .catch((err: any) => { console.error(err.message) })
      .finally(() => setLoading(false))
    getManagerOverview()
      .then((data) => { setOverview(data) })
      .catch((err: any) => { console.error('overview fetch error', err.message) })
  }

  useEffect(() => {
    if (!tenantSlug) return
    refreshManagerData()
  }, [tenantSlug])

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
      } catch (err: any) { console.error('SSE parse error', err.message) }
    }
    eventSource.onerror = () => setSseConnected(false)
    return () => { eventSource.close() }
  }, [])

  useEffect(() => {
    getClients().then((rows) => setClientsList(rows)).catch((err: any) => { console.error(err.message) })
  }, [clientMsg])

  useEffect(() => {
    getAssignments().then((res) => setAssignmentsList(res.assignments || [])).catch((err: any) => { console.error(err.message) })
  }, [scheduleMsg])

  useEffect(() => {
    // logs tab uses shared clientsList
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

  function CircularProgress({ value, size = 48, strokeWidth = 4, color = COLORS.teal }: { value: number; size?: number; strokeWidth?: number; color?: string }) {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (value / 100) * circumference

    return (
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(0,0,0,0.05)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <motion.circle
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute text-[10px] font-bold text-slate-800">{Math.round(value)}%</div>
      </div>
    )
  }

  function ComplianceCard({ label, rate, detail, onClick }: { label: string; rate: number; detail: string; onClick: () => void }) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-slate-300 mb-1.5">{label}</div>
        <CircularProgress value={rate} />
        <div className="text-[10px] text-slate-400">{detail}</div>
      </div>
    )
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800">Daily Compliance</h3>
            <p className="text-[11px] text-slate-400">{stats.completed} of {stats.total} visits completed</p>
          </div>
          <CircularProgress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} size={54} strokeWidth={5} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-50">
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
        {(() => {
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          const counts = days.map((day, i) => {
            const targetDay = (i + 1) % 7 || 7
            return dbVisits.filter((v: any) => {
              const d = v.submitted_at ? new Date(v.submitted_at) : null
              return d && d.getDay() === targetDay
            }).length
          })
          const maxCount = Math.max(...counts, 1)
          if (dbVisits.length === 0) {
            return <div className="text-center py-6 text-slate-400 text-sm">No visits recorded yet</div>
          }
          return (
            <div className="flex items-end gap-2 h-24">
              {days.map((day, idx) => {
                const value = counts[idx]
                const isToday = idx === (new Date().getDay() + 6) % 7
                return (
                  <motion.div
                    key={day}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.3 + idx * 0.05, duration: 0.5, ease: 'easeOut' }}
                    className="flex-1 flex flex-col items-center gap-1.5 origin-bottom"
                  >
                    <div className="w-full relative rounded-lg overflow-hidden" style={{ height: `${(value / maxCount) * 100}%`, minHeight: value > 0 ? 8 : 4 }}>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: '100%' }}
                        transition={{ delay: 0.3 + idx * 0.05, duration: 0.6, ease: 'easeOut' }}
                        className="absolute bottom-0 left-0 right-0 rounded-lg"
                        style={{ background: isToday ? `linear-gradient(180deg, ${COLORS.teal}, ${COLORS.teal2})` : 'linear-gradient(180deg, #e2e8f0, #cbd5e1)' }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{day}</span>
                  </motion.div>
                )
              })}
            </div>
          )
        })()}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Visits Today', value: overview?.kpis ? String(overview.kpis.visitsCompleted + overview.kpis.visitsInProgress) : String(stats.total), sub: overview?.kpis ? `${overview.kpis.visitsCompleted} done · ${overview.kpis.visitsInProgress} active` : `${stats.completed} done · ${stats.inProgress} active`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> },
          { label: 'Medications', value: overview?.kpis ? `${overview.kpis.medicationsConfirmed}/${Math.max(overview.kpis.medicationsTotal, 1)}` : `${stats.medConfirmed}/${Math.max(dbMedications.length, 1)}`, sub: overview?.kpis ? `${overview.kpis.medicationsSkipped} skipped` : `${stats.medSkipped} skipped`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 11-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3l8.5 8.5 8-8Z"/></svg> },
          { label: 'Carers On Duty', value: overview?.kpis ? String(overview.kpis.carersTotal) : String(dbCarers.length), sub: overview?.kpis ? `${overview.kpis.carersActive} active` : `${dbCarers.filter((c: any) => c.status === 'active').length} active · ${dbCarers.filter((c: any) => c.status === 'suspended').length} suspended`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          { label: 'Alerts', value: overview?.kpis ? String(overview.kpis.alertsCount) : String(allIncidents.length), sub: overview?.kpis ? `${overview.kpis.sosAlerts} SOS · ${overview.kpis.incidents} incidents` : `${highSeverityCount} high · ${allIncidents.length - highSeverityCount} medium`, alert: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg> },
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

      {/* Compliance Alerts */}
      {overview?.alerts && overview.alerts.length > 0 && (
        <motion.div custom={5} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Compliance Alerts</h3>
          <div className="flex flex-col gap-2">
            {overview.alerts.map((alert: any, idx: number) => (
              <motion.button
                key={alert.type}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + idx * 0.05, duration: 0.3 }}
                onClick={() => {
                  if (alert.type.startsWith('dbs')) setLocation(`/tenant/${tenantSlug}/dbs`)
                  else if (alert.type.startsWith('train')) setLocation(`/tenant/${tenantSlug}/training`)
                  else if (alert.type.startsWith('rtw')) setLocation(`/tenant/${tenantSlug}/right-to-work`)
                  else if (alert.type === 'leave_pending') setLocation(`/tenant/${tenantSlug}/availability`)
                }}
                className="flex items-center gap-3 text-left p-2.5 rounded-xl cursor-pointer border-none transition-all hover:scale-[1.01]"
                style={{ background: alert.severity === 'high' ? 'rgba(255,90,95,0.05)' : 'rgba(246,183,60,0.05)' }}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: alert.severity === 'high' ? 'rgba(255,90,95,0.1)' : 'rgba(246,183,60,0.1)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={alert.severity === 'high' ? COLORS.red : COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div className="flex-1 text-xs font-medium text-slate-600">{alert.message}</div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Compliance Quick Stats */}
      {overview?.compliance && (
        <motion.div custom={5} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Compliance Overview</h3>
          <div className="grid grid-cols-3 gap-2">
            <ComplianceCard
              label="DBS"
              rate={overview.compliance.dbs.complianceRate}
              detail={`${overview.compliance.dbs.expired} exp · ${overview.compliance.dbs.expiring} soon`}
              onClick={() => setLocation(`/tenant/${tenantSlug}/dbs`)}
            />
            <ComplianceCard
              label="Training"
              rate={overview.compliance.training.total > 0 ? Math.round((overview.compliance.training.valid / overview.compliance.training.total) * 100) : 100}
              detail={`${overview.compliance.training.expired} exp · ${overview.compliance.training.expiring} soon`}
              onClick={() => setLocation(`/tenant/${tenantSlug}/training`)}
            />
            <ComplianceCard
              label="RTW"
              rate={overview.compliance.rightToWork.total > 0 ? Math.round((overview.compliance.rightToWork.verified / overview.compliance.rightToWork.total) * 100) : 100}
              detail={`${overview.compliance.rightToWork.pending} pend · ${overview.compliance.rightToWork.rejected} rej`}
              onClick={() => setLocation(`/tenant/${tenantSlug}/right-to-work`)}
            />
          </div>
        </motion.div>
      )}

      {/* Pending Leave Requests */}
      {overview?.leaveRequests && overview.leaveRequests.length > 0 && (
        <motion.div custom={6} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-800">Pending Leave Requests</h3>
            <button onClick={() => setLocation(`/tenant/${tenantSlug}/availability`)} className="text-[10px] font-semibold text-teal-600 bg-transparent border-none cursor-pointer">View all</button>
          </div>
          <div className="flex flex-col gap-2">
            {overview.leaveRequests.slice(0, 3).map((lr: any, idx: number) => (
              <div key={lr.id || idx} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'rgba(246,183,60,0.04)' }}>
                <div>
                  <div className="text-xs font-semibold text-slate-700">{lr.carerName || 'Unknown'}</div>
                  <div className="text-[10px] text-slate-400">{lr.type || 'Leave'} · {lr.startDate} to {lr.endDate}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(246,183,60,0.1)', color: COLORS.amber }}>Pending</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Upcoming Supervisions */}
      {overview?.upcomingSupervisions && overview.upcomingSupervisions.length > 0 && (
        <motion.div custom={6} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-800">Upcoming Supervisions</h3>
            <button onClick={() => setLocation(`/tenant/${tenantSlug}/supervisions`)} className="text-[10px] font-semibold text-teal-600 bg-transparent border-none cursor-pointer">View all</button>
          </div>
          <div className="flex flex-col gap-2">
            {overview.upcomingSupervisions.slice(0, 3).map((sup: any, idx: number) => (
              <div key={sup.id || idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <div>
                  <div className="text-xs font-semibold text-slate-700 capitalize">{sup.type || 'Supervision'} · {sup.carerName || 'Unknown'}</div>
                  <div className="text-[10px] text-slate-400">{sup.scheduledDate}{sup.scheduledTime ? ` at ${sup.scheduledTime}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Links */}
      <motion.div custom={6} variants={cardVariants} className="grid grid-cols-4 gap-2">
        {[
          { label: 'DBS', path: `/tenant/${tenantSlug}/dbs`, color: COLORS.teal },
          { label: 'Training', path: `/tenant/${tenantSlug}/training`, color: COLORS.lavender },
          { label: 'RTW', path: `/tenant/${tenantSlug}/right-to-work`, color: COLORS.amber },
          { label: 'Messages', path: `/tenant/${tenantSlug}/messages`, color: COLORS.red },
        ].map((link) => (
          <button
            key={link.label}
            onClick={() => setLocation(link.path)}
            className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm cursor-pointer transition-all hover:shadow-md text-center border-none"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1" style={{ background: `${link.color}15` }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: link.color }} />
            </div>
            <div className="text-[9px] font-semibold text-slate-500">{link.label}</div>
          </button>
        ))}
      </motion.div>

      {/* Export */}
      <motion.div custom={6} variants={cardVariants} className="flex gap-2">
        <button onClick={() => exportVisits(dbVisits)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 cursor-pointer hover:border-teal transition-colors">
          Export Visits
        </button>
        <button onClick={() => exportCarers(dbCarers)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 cursor-pointer hover:border-teal transition-colors">
          Export Carers
        </button>
      </motion.div>

      {/* Data & Privacy (DPA controls) */}
      <motion.div custom={6} variants={cardVariants} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <h3 className="font-bold text-sm text-slate-800 mb-3">Data & Privacy</h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.open(exportAgencyDataUrl(), '_blank')}
            className="text-left text-sm text-slate-600 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer bg-transparent border border-slate-200"
          >
            Export all agency data (JSON)
          </button>
          <button
            onClick={async () => {
              const confirmed = window.confirm('WARNING: This will permanently delete all client records, visits, medications, and carer data for your agency. Managers and the agency record remain for audit purposes.\n\nType "DELETE ALL DATA" in the next prompt to confirm.')
              if (!confirmed) return
              const text = window.prompt('Type "DELETE ALL DATA" to confirm permanent deletion:')
              if (text !== 'DELETE ALL DATA') {
                alert('Deletion cancelled.')
                return
              }
              try {
                const res = await deleteAgencyData('DELETE ALL DATA')
                alert(`Agency data deleted. ${res.totalDeleted || 0} records removed.`)
              } catch (err: any) {
                alert(err.message || 'Deletion failed.')
              }
            }}
            className="text-left text-sm text-red-600 py-2 px-3 rounded-xl hover:bg-red-50 transition-colors cursor-pointer bg-transparent border border-red-200"
          >
            Delete all agency data
          </button>
        </div>
      </motion.div>

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
                      background: carer.status === 'active' ? 'rgba(79,209,197,0.1)' : carer.status === 'suspended' ? 'rgba(255,90,95,0.1)' : '#f1f5f9',
                      color: carer.status === 'active' ? COLORS.teal : carer.status === 'suspended' ? COLORS.red : '#94a3b8',
                      border: `1px solid ${carer.status === 'active' ? 'rgba(79,209,197,0.15)' : carer.status === 'suspended' ? 'rgba(255,90,95,0.15)' : 'transparent'}`,
                    }}
                  >
                    {carer.status}
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
            <div className="w-full mt-2 py-2 text-xs font-semibold text-slate-400 text-center">
              +{allIncidents.length - 5} more alerts
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )

  const renderTeam = () => {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        await createCaregiver({ name: teamName, email: teamEmail, phone: teamPhone, region: teamRegion, pin: teamPin, role: teamRole })
        setTeamMsg('Caregiver created')
        setTeamName(''); setTeamEmail(''); setTeamPhone(''); setTeamRegion(''); setTeamPin('')
        setTeamShowAdd(false)
        refreshManagerData()
      } catch (err: any) { setTeamMsg(err.message || 'Failed') }
    }

    return (
      <motion.div className="flex flex-col gap-3" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-800">Caregivers</h2>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTeamShowAdd(!teamShowAdd)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer flex items-center gap-1" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {teamShowAdd ? 'Close' : 'Add'}
          </motion.button>
        </div>

        {teamShowAdd && (
          <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col gap-3">
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
            <input value={teamEmail} onChange={(e) => setTeamEmail(e.target.value)} placeholder="Email" type="email" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
            <input value={teamPhone} onChange={(e) => setTeamPhone(e.target.value)} placeholder="Phone" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
            <input value={teamRegion} onChange={(e) => setTeamRegion(e.target.value)} placeholder="Region" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
            <input value={teamPin} onChange={(e) => setTeamPin(e.target.value)} placeholder="PIN (4-6 digits)" type="password" maxLength={6} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
            <select value={teamRole} onChange={(e) => setTeamRole(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white">
              <option value="carer">Carer</option>
              <option value="manager">Manager</option>
            </select>
            <motion.button whileTap={{ scale: 0.97 }} type="submit" className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>Create Caregiver</motion.button>
            {teamMsg && <div className="text-xs text-slate-500">{teamMsg}</div>}
          </motion.form>
        )}

        {dbCarers.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
            <div className="text-slate-500 text-sm font-medium mb-1">No carers found</div>
            <div className="text-slate-400 text-xs">Add carers using the button above.</div>
          </motion.div>
        )}
        {dbCarers.map((carer: any, idx: number) => (
          <motion.div
            key={carer.id}
            custom={idx}
            variants={cardVariants}
            whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
            onClick={() => { setSelectedCarer(carer); setShowCarerModal(true); setCarerActionMsg('') }}
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm cursor-pointer"
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
                    background: carer.status === 'active' ? 'rgba(79,209,197,0.1)' : carer.status === 'suspended' ? 'rgba(255,90,95,0.1)' : '#f1f5f9',
                    color: carer.status === 'active' ? COLORS.teal : carer.status === 'suspended' ? COLORS.red : '#94a3b8',
                    border: `1px solid ${carer.status === 'active' ? 'rgba(79,209,197,0.15)' : carer.status === 'suspended' ? 'rgba(255,90,95,0.15)' : 'transparent'}`,
                  }}
                >
                  {carer.status}
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
                <span className="text-slate-700">{dbVisits.filter((v: any) => v.carer_id === carer.id).length} visits</span>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Carer Detail Modal */}
        {showCarerModal && selectedCarer && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowCarerModal(false)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.darkNavy})` }}>
                  {selectedCarer.avatar}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800">{selectedCarer.name}</div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: selectedCarer.status === 'active' ? 'rgba(79,209,197,0.1)' : 'rgba(255,90,95,0.1)',
                      color: selectedCarer.status === 'active' ? COLORS.teal : COLORS.red,
                      border: `1px solid ${selectedCarer.status === 'active' ? 'rgba(79,209,197,0.15)' : 'rgba(255,90,95,0.15)'}`,
                    }}
                  >
                    {selectedCarer.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-sm mb-5">
                <div className="flex justify-between"><span className="text-slate-400">Email</span><span className="text-slate-700">{selectedCarer.email || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Phone</span><span className="text-slate-700">{selectedCarer.phone || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Region</span><span className="text-slate-700">{selectedCarer.location || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Visits</span><span className="text-slate-700">{dbVisits.filter((v: any) => v.carer_id === selectedCarer.id).length}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Joined</span><span className="text-slate-700">{selectedCarer.since || '—'}</span></div>
              </div>
              <div className="flex flex-col gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={async () => {
                    try {
                      const newStatus = selectedCarer.status === 'active' ? 'suspended' : 'active'
                      await updateCaregiverStatus(selectedCarer.id, newStatus)
                      setCarerActionMsg(`Caregiver ${newStatus}`)
                      refreshManagerData()
                      setSelectedCarer({ ...selectedCarer, status: newStatus })
                    } catch (err: any) { setCarerActionMsg(err.message || 'Failed') }
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                  style={{ background: selectedCarer.status === 'active' ? COLORS.amber : COLORS.teal }}
                >
                  {selectedCarer.status === 'active' ? 'Suspend' : 'Activate'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={async () => {
                    if (!confirm('Are you sure you want to delete this caregiver?')) return
                    try {
                      await deleteCaregiver(selectedCarer.id)
                      setCarerActionMsg('Caregiver deleted')
                      setShowCarerModal(false)
                      refreshManagerData()
                    } catch (err: any) { setCarerActionMsg(err.message || 'Failed') }
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                  style={{ background: COLORS.red }}
                >
                  Delete
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    const email = selectedCarer.email
                    if (email) window.location.href = `mailto:${email}`
                    else setCarerActionMsg('No email available')
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                  style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
                >
                  Send Message
                </motion.button>
                {carerActionMsg && <div className="text-xs text-slate-500 text-center">{carerActionMsg}</div>}
              </div>
              <button onClick={() => setShowCarerModal(false)} className="w-full mt-3 py-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">Close</button>
            </motion.div>
          </div>
        )}
      </motion.div>
    )
  }

  function renderClients() {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        const id = 'cl-' + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(0, 4)
        await createClient({
          id,
          name: clientName,
          age: clientAge ? parseInt(clientAge) : undefined,
          address: clientAddress || undefined,
          conditions: clientConditions.split(',').map((s) => s.trim()).filter(Boolean),
          medications: clientMedications.split(',').map((s) => {
            const parts = s.trim().split('—')
            return { name: parts[0] || s.trim(), dose: parts[1] || '-', frequency: parts[2] || 'daily' }
          }).filter((m) => m.name),
          preferences: clientPreferences || undefined,
          emergencyContact: clientEmergency || undefined,
        })
        setClientMsg('Client created')
        setClientName(''); setClientAge(''); setClientAddress(''); setClientConditions(''); setClientMedications(''); setClientPreferences(''); setClientEmergency('')
        setClientShowAdd(false)
        getClients().then((rows) => setClientsList(rows)).catch((err: any) => { console.error(err.message) })
      } catch (err: any) { setClientMsg(err.message || 'Failed') }
    }

    const openClientModal = async (c: any) => {
      setClientActionMsg('')
      try {
        const detail = await fetchClient(c.id)
        setSelectedClientDetail(detail)
        setShowClientModal(true)
      } catch {
        setSelectedClientDetail(c)
        setShowClientModal(true)
      }
    }

    return (
      <motion.div className="flex flex-col gap-3" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-800">Clients</h2>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => exportClients(clientsList)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer flex items-center gap-1" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>
              Export
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setClientShowAdd(!clientShowAdd)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer flex items-center gap-1" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {clientShowAdd ? 'Close' : 'Add'}
          </motion.button>
          </div>
        </div>

        {clientShowAdd && (
          <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col gap-3">
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" required />
            <input value={clientAge} onChange={(e) => setClientAge(e.target.value)} placeholder="Age" type="number" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
            <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Address" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
            <input value={clientConditions} onChange={(e) => setClientConditions(e.target.value)} placeholder="Conditions (comma separated)" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
            <input value={clientMedications} onChange={(e) => setClientMedications(e.target.value)} placeholder="Medications: Name—Dose—Frequency (comma separated)" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
            <input value={clientPreferences} onChange={(e) => setClientPreferences(e.target.value)} placeholder="Care preferences" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
            <input value={clientEmergency} onChange={(e) => setClientEmergency(e.target.value)} placeholder="Emergency contact" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal" />
            <motion.button whileTap={{ scale: 0.97 }} type="submit" className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>Create Client</motion.button>
            {clientMsg && <div className="text-xs text-slate-500">{clientMsg}</div>}
          </motion.form>
        )}

        <div className="flex flex-col gap-2">
          {clientsList.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No clients yet</div>}
          {clientsList.map((c: any) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => openClientModal(c)}
              className="bg-white rounded-xl p-3 border border-slate-200 text-sm cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-700">{c.name}</div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setLocation(`/tenant/${tenantSlug}/manager/clients/${c.id}/care-plan/edit`)
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-medium hover:bg-teal/20 transition-colors"
                  >
                    Care Plan
                  </button>
                  {c.age && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{c.age} yrs</span>}
                </div>
              </div>
              {c.address && <div className="text-xs text-slate-400 mt-0.5">{c.address}</div>}
              {Array.isArray(c.conditions) && c.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {c.conditions.map((cond: string, i: number) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700">{cond}</span>
                  ))}
                </div>
              )}
              {Array.isArray(c.medications) && c.medications.length > 0 && (
                <div className="text-[10px] text-slate-400 mt-1">{c.medications.length} medication{c.medications.length > 1 ? 's' : ''}</div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Client Detail Modal */}
        {showClientModal && selectedClientDetail && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowClientModal(false)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[85vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>
                  {selectedClientDetail.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800">{selectedClientDetail.name}</div>
                  {selectedClientDetail.age && <div className="text-xs text-slate-400">{selectedClientDetail.age} years old</div>}
                </div>
              </div>

              <div className="flex flex-col gap-3 text-sm mb-5">
                {selectedClientDetail.address && (
                  <div>
                    <div className="text-slate-400 text-xs mb-0.5">Address</div>
                    <div className="text-slate-700">{selectedClientDetail.address}</div>
                  </div>
                )}
                {Array.isArray(selectedClientDetail.conditions) && selectedClientDetail.conditions.length > 0 && (
                  <div>
                    <div className="text-slate-400 text-xs mb-1">Conditions</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedClientDetail.conditions.map((cond: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">{cond}</span>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(selectedClientDetail.medications) && selectedClientDetail.medications.length > 0 && (
                  <div>
                    <div className="text-slate-400 text-xs mb-1">Medications</div>
                    <div className="flex flex-col gap-1">
                      {selectedClientDetail.medications.map((med: any, i: number) => (
                        <div key={i} className="text-xs text-slate-700 bg-slate-50 rounded-lg p-2">
                          <span className="font-medium">{med.name}</span>
                          {med.dose && <span className="text-slate-400"> · {med.dose}</span>}
                          {med.frequency && <span className="text-slate-400"> · {med.frequency}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedClientDetail.preferences && (
                  <div>
                    <div className="text-slate-400 text-xs mb-0.5">Care Preferences</div>
                    <div className="text-slate-700 text-xs">{selectedClientDetail.preferences}</div>
                  </div>
                )}
                {selectedClientDetail.emergency_contact && (
                  <div>
                    <div className="text-slate-400 text-xs mb-0.5">Emergency Contact</div>
                    <div className="text-slate-700">{selectedClientDetail.emergency_contact}</div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setShowClientModal(false)
                    setShowFamilyInvite(true)
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                  style={{ background: COLORS.lavender }}
                >
                  Invite Family
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    const phone = selectedClientDetail.emergency_contact || ''
                    if (phone) window.location.href = `tel:${phone}`
                    else setClientActionMsg('No emergency contact available')
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                  style={{ background: COLORS.teal }}
                >
                  Call Emergency Contact
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={async () => {
                    if (!confirm('Are you sure you want to delete this client?')) return
                    try {
                      await deleteClient(selectedClientDetail.id)
                      setClientActionMsg('Client deleted')
                      setShowClientModal(false)
                      getClients().then((rows) => setClientsList(rows)).catch((err: any) => { console.error(err.message) })
                    } catch (err: any) { setClientActionMsg(err.message || 'Failed') }
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                  style={{ background: COLORS.red }}
                >
                  Delete Client
                </motion.button>
                {clientActionMsg && <div className="text-xs text-slate-500 text-center">{clientActionMsg}</div>}
              </div>
              <button onClick={() => setShowClientModal(false)} className="w-full mt-3 py-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">Close</button>
            </motion.div>
          </div>
        )}

        {/* Family Invitation Modal */}
        <AnimatePresence>
          {showFamilyInvite && selectedClientDetail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto"
              onClick={() => setShowFamilyInvite(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg my-4 sm:my-0 max-h-[85dvh] overflow-y-auto rounded-xl"
              >
                <FamilyMemberInvitation
                  clientId={selectedClientDetail.id}
                  clientName={selectedClientDetail.name}
                  onClose={() => setShowFamilyInvite(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  function renderSchedule() {
    const handleAssign = async () => {
      if (!scheduleCaregiverId || !scheduleClientId) { setScheduleMsg('Select both caregiver and client'); return }
      try {
        await createAssignment({
          caregiverId: scheduleCaregiverId,
          clientId: scheduleClientId,
          visitDate: scheduleDate || undefined,
          visitTime: scheduleTime || undefined,
          instructions: scheduleInstructions || undefined,
        })
        setScheduleMsg('Assigned successfully')
        setScheduleCaregiverId(''); setScheduleClientId(''); setScheduleDate(''); setScheduleTime(''); setScheduleInstructions('')
        const res = await getAssignments()
        setAssignmentsList(res.assignments || [])
      } catch (err: any) {
        setScheduleMsg(err.message || 'Failed to assign')
      }
    }

    const handleUnassign = async (cgId: string, clId: string) => {
      try {
        await deleteAssignment(cgId, clId)
        setScheduleMsg('Unassigned successfully')
        const res = await getAssignments()
        setAssignmentsList(res.assignments || [])
      } catch (err: any) {
        setScheduleMsg(err.message || 'Failed to unassign')
      }
    }

    const startEdit = (a: any) => {
      setEditingAssignmentId(a.id)
      setEditAssignDate(a.visitDate || '')
      setEditAssignTime(a.visitTime || '')
      setEditAssignInstructions(a.instructions || '')
    }

    const cancelEdit = () => {
      setEditingAssignmentId(null)
      setEditAssignDate('')
      setEditAssignTime('')
      setEditAssignInstructions('')
    }

    const handleUpdate = async (id: string) => {
      try {
        await updateAssignment(id, {
          visitDate: editAssignDate || undefined,
          visitTime: editAssignTime || undefined,
          instructions: editAssignInstructions || undefined,
        })
        setScheduleMsg('Updated successfully')
        cancelEdit()
        const res = await getAssignments()
        setAssignmentsList(res.assignments || [])
      } catch (err: any) {
        setScheduleMsg(err.message || 'Failed to update')
      }
    }

    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-slate-800">Assign Client to Caregiver</h2>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col gap-3">
          <select value={scheduleCaregiverId} onChange={(e) => setScheduleCaregiverId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white">
            <option value="">Select caregiver</option>
            {dbCarers.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select value={scheduleClientId} onChange={(e) => setScheduleClientId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white">
            <option value="">Select client</option>
            {clientsList.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white"
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white"
            />
          </div>
          <textarea
            value={scheduleInstructions}
            onChange={(e) => setScheduleInstructions(e.target.value)}
            placeholder="Instructions (e.g. check blood pressure, prepare meds...)"
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white resize-none"
          />
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleAssign} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>Assign</motion.button>
          {scheduleMsg && <div className="text-xs text-slate-500">{scheduleMsg}</div>}
        </div>
        <h3 className="font-bold text-slate-800 mt-2">Current Assignments</h3>
        <div className="flex flex-col gap-2">
          {assignmentsList.map((a) => {
            const isEditing = editingAssignmentId === a.id
            return (
              <div key={a.id} className="bg-white rounded-xl p-3 border border-slate-200 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <div className="font-semibold text-slate-700">{a.clientName}</div>
                    <div className="text-xs text-slate-400">Caregiver: {a.caregiverName}</div>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleUpdate(a.id)} className="px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer" style={{ borderColor: 'rgba(79,209,197,0.3)', color: COLORS.teal }}>Save</motion.button>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={cancelEdit} className="px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>Cancel</motion.button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => startEdit(a)} className="px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>Edit</motion.button>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleUnassign(a.caregiverId, a.clientId)} className="px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>Unassign</motion.button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={editAssignDate}
                        onChange={(e) => setEditAssignDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white"
                      />
                      <input
                        type="time"
                        value={editAssignTime}
                        onChange={(e) => setEditAssignTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white"
                      />
                    </div>
                    <textarea
                      value={editAssignInstructions}
                      onChange={(e) => setEditAssignInstructions(e.target.value)}
                      placeholder="Instructions"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white resize-none"
                    />
                  </div>
                ) : (
                  <>
                    {(a.visitDate || a.visitTime) && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
                        <span className="flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                          {a.visitDate && new Date(a.visitDate).toLocaleDateString('en-GB')}
                          {a.visitDate && a.visitTime && ' · '}
                          {a.visitTime}
                        </span>
                      </div>
                    )}
                    {a.instructions && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2 mt-1">{a.instructions}</div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderLogs() {
    const handleFetchLogs = async (clientId: string) => {
      setLogsSelectedClient(clientId)
      try {
        const res = await getClientLogs(clientId)
        setLogsList(res.logs || [])
      } catch { setLogsList([]) }
    }

    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-slate-800">Client Care Logs</h2>
        <select
          value={logsSelectedClient}
          onChange={(e) => handleFetchLogs(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white"
        >
          <option value="">Select a client to view logs</option>
          {clientsList.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {logsSelectedClient && (
          <div className="flex flex-col gap-2">
            {logsList.length === 0 && <div className="text-sm text-slate-400">No logs found for this client.</div>}
            {logsList.map((log) => (
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
          <div className="flex items-center gap-2 overflow-x-auto -mr-6 pr-6 pl-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            <span className="text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium shrink-0" style={{ background: sseConnected ? 'rgba(79,209,197,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${sseConnected ? 'rgba(79,209,197,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: sseConnected ? COLORS.teal : '#94a3b8' }} />
              <span style={{ color: sseConnected ? COLORS.teal : '#94a3b8' }}>{sseConnected ? 'Live' : 'Offline'}</span>
            </span>
            <button
              onClick={() => tenantSlug && setLocation(`/tenant/${tenantSlug}/manager/clients`)}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target shrink-0"
              title="Client Management"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button
              onClick={() => tenantSlug && setLocation(`/tenant/${tenantSlug}/manager/schedule`)}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target shrink-0"
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
              onClick={() => tenantSlug && setLocation(`/tenant/${tenantSlug}/settings`)}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target shrink-0"
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <button
              onClick={async () => {
                try { await logoutUser() } catch (err: any) { console.error('logout failed', err.message) }
                clearAuthCache()
                localStorage.removeItem('carei_current_tenant')
                setLocation('/login')
              }}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target shrink-0"
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
            { key: 'team' as const, label: 'Team' },
            { key: 'clients' as const, label: 'Clients' },
            { key: 'schedule' as const, label: 'Schedule' },
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
              {t.key === 'overview' && allIncidents.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: COLORS.red, color: 'white' }}>{allIncidents.length}</span>
              )}
            </motion.button>
          ))}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => tenantSlug && setLocation(`/tenant/${tenantSlug}/manager/audit`)}
            className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-all duration-200"
            style={{ background: 'transparent', color: '#64748b' }}
          >
            Audit
          </motion.button>
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
        {!loading && tab === 'team' && renderTeam()}
        {!loading && tab === 'clients' && renderClients()}
        {!loading && tab === 'schedule' && renderSchedule()}
        {!loading && tab === 'logs' && renderLogs()}
      </motion.div>

      <BiometricsPrompt />
      </div>
    </div>
  )
}
