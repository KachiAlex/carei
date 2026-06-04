import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'wouter'
import { todayVisits, clients } from '../data/clients'
import { getManagerData } from '../api/client'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  amber: '#F6B73C',
  red: '#FF5A5F',
}

// Mock carer data for manager view
const carers = [
  { id: 'c1', name: 'Sarah Johnson', status: 'in-visit', location: '12 Oak St', client: 'Margaret Wilson', since: '09:15', avatar: 'SJ' },
  { id: 'c2', name: 'James Brown', status: 'in-visit', location: '45 Elm Ave', client: 'Robert Davies', since: '10:00', avatar: 'JB' },
  { id: 'c3', name: 'Amina Patel', status: 'traveling', location: 'En route', client: 'Dorothy Lewis', since: '—', avatar: 'AP' },
  { id: 'c4', name: 'David Chen', status: 'available', location: '—', client: '—', since: '—', avatar: 'DC' },
]

const incidents = [
  { id: 'i1', carer: 'Sarah Johnson', client: 'Margaret Wilson', type: 'Medication skipped', time: '09:45', severity: 'medium' as const },
  { id: 'i2', carer: 'James Brown', client: 'Robert Davies', type: 'SOS alert', time: '10:22', severity: 'high' as const },
]

const medicationsToday = [
  { name: 'Donepezil', client: 'Margaret Wilson', time: '09:00', status: 'confirmed' as const, carer: 'Sarah Johnson' },
  { name: 'Metformin', client: 'Margaret Wilson', time: '09:00', status: 'skipped' as const, carer: 'Sarah Johnson', reason: 'Client refused' },
  { name: 'Amlodipine', client: 'Robert Davies', time: '10:00', status: 'confirmed' as const, carer: 'James Brown' },
  { name: 'Warfarin', client: 'Dorothy Lewis', time: '11:00', status: 'pending' as const, carer: 'Amina Patel' },
]

export default function ManagerDashboard() {
  const [, setLocation] = useLocation()
  const [tab, setTab] = useState<'overview' | 'carers' | 'mar' | 'incidents'>('overview')
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null)
  const [liveIncidents, setLiveIncidents] = useState(incidents)
  const [sseConnected, setSseConnected] = useState(false)
  const [dbCarers, setDbCarers] = useState<any[]>([])
  const [dbVisits, setDbVisits] = useState<any[]>([])
  const [dbAlerts, setDbAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getManagerData()
      .then((data) => {
        setDbCarers(data.carers || [])
        setDbVisits(data.visits || [])
        setDbAlerts(data.alerts || [])
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
        }
      } catch {}
    }
    eventSource.onerror = () => setSseConnected(false)
    return () => { eventSource.close() }
  }, [])

  const allIncidents = [...dbAlerts.map((a: any) => ({
    id: a.id,
    carer: a.visit_id || 'Unknown',
    client: a.location || 'Unknown',
    type: 'SOS Alert',
    time: new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    severity: 'high' as const,
  })), ...liveIncidents]

  const stats = useMemo(() => {
    const total = dbVisits.length || todayVisits.length
    const completed = dbVisits.filter((v: any) => v.status === 'completed').length || todayVisits.filter((v) => v.status === 'completed').length
    const inProgress = dbVisits.filter((v: any) => v.status === 'in-progress').length || todayVisits.filter((v) => v.status === 'in-progress').length
    const pending = dbVisits.filter((v: any) => v.status === 'pending').length || todayVisits.filter((v) => v.status === 'pending').length
    const medConfirmed = medicationsToday.filter((m) => m.status === 'confirmed').length
    const medSkipped = medicationsToday.filter((m) => m.status === 'skipped').length
    return { total, completed, inProgress, pending, medConfirmed, medSkipped }
  }, [dbVisits])

  const highSeverityCount = allIncidents.filter((i) => i.severity === 'high').length

  const renderOverview = () => (
    <div className="flex flex-col gap-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Visits Today', value: stats.total, sub: `${stats.completed} done · ${stats.inProgress} active` },
          { label: 'Medications', value: `${stats.medConfirmed}/${medicationsToday.length}`, sub: `${stats.medSkipped} skipped` },
          { label: 'Carers On Duty', value: '4', sub: '2 in visit · 1 traveling' },
          { label: 'Alerts', value: `${allIncidents.length}`, sub: `${highSeverityCount} high · ${allIncidents.length - highSeverityCount} medium`, alert: true },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3 border border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{s.label}</div>
            <div className="text-xl font-bold text-slate-800">{s.value}</div>
            <div className={`text-[10px] ${s.alert ? 'text-red-400' : 'text-slate-400'}`}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Live Carer Status */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-800">Live Carer Status</h3>
          <span className="flex items-center gap-1 text-[10px] text-teal font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {(dbCarers.length ? dbCarers : carers).map((carer: any) => (
            <div key={carer.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: COLORS.navy }}>
                {carer.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{carer.name}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: carer.status === 'in-visit' ? 'rgba(79,209,197,0.1)' : carer.status === 'traveling' ? 'rgba(246,183,60,0.1)' : '#f1f5f9',
                      color: carer.status === 'in-visit' ? COLORS.teal : carer.status === 'traveling' ? COLORS.amber : '#94a3b8',
                    }}
                  >
                    {carer.status.replace('-', ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {carer.client ? `${carer.client} · ${carer.location}` : carer.location}
                </div>
              </div>
              <div className="text-xs text-slate-400 shrink-0">{carer.since}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Incidents */}
      {allIncidents.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Recent Alerts</h3>
          <div className="flex flex-col gap-2">
            {allIncidents.map((inc) => (
              <button
                key={inc.id}
                onClick={() => setSelectedIncident(inc.id)}
                className="flex items-center gap-3 text-left p-3 rounded-xl cursor-pointer border-none bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: inc.severity === 'high' ? 'rgba(255,90,95,0.1)' : 'rgba(246,183,60,0.1)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inc.severity === 'high' ? COLORS.red : COLORS.amber} strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700">{inc.type}</div>
                  <div className="text-xs text-slate-400">{inc.carer} · {inc.client}</div>
                </div>
                <div className="text-xs text-slate-400 shrink-0">{inc.time}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderCarers = () => (
    <div className="flex flex-col gap-3">
      {(dbCarers.length ? dbCarers : carers).map((carer: any) => (
        <div key={carer.id} className="bg-white rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: COLORS.navy }}>
              {carer.avatar}
            </div>
            <div>
              <div className="font-bold text-sm text-slate-800">{carer.name}</div>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: carer.status === 'in-visit' ? 'rgba(79,209,197,0.1)' : carer.status === 'traveling' ? 'rgba(246,183,60,0.1)' : '#f1f5f9',
                  color: carer.status === 'in-visit' ? COLORS.teal : carer.status === 'traveling' ? COLORS.amber : '#94a3b8',
                }}
              >
                {carer.status.replace('-', ' ')}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div>Location: <span className="text-slate-700">{carer.location}</span></div>
            <div>Client: <span className="text-slate-700">{carer.client || '—'}</span></div>
            <div>Since: <span className="text-slate-700">{carer.since}</span></div>
            <div>Visits today: <span className="text-slate-700">3</span></div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderMAR = () => (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-2xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-800">Medication Administration Record</h3>
          <span className="text-xs text-slate-400">{new Date().toLocaleDateString('en-GB')}</span>
        </div>
        <div className="flex flex-col gap-2">
          {medicationsToday.map((med, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: 'rgba(0,0,0,0.06)', background: med.status === 'skipped' ? 'rgba(255,90,95,0.03)' : 'white' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-700">{med.name}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: med.status === 'confirmed' ? 'rgba(79,209,197,0.1)' : med.status === 'skipped' ? 'rgba(255,90,95,0.08)' : '#f1f5f9',
                      color: med.status === 'confirmed' ? COLORS.teal : med.status === 'skipped' ? COLORS.red : '#94a3b8',
                    }}
                  >
                    {med.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{med.client} · {med.time} · {med.carer}</div>
                {med.reason && <div className="text-[10px] text-red-400 mt-0.5">Reason: {med.reason}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderIncidents = () => (
    <div className="flex flex-col gap-3">
      {allIncidents.map((inc) => (
        <div key={inc.id} className="bg-white rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: inc.severity === 'high' ? 'rgba(255,90,95,0.08)' : 'rgba(246,183,60,0.1)',
                color: inc.severity === 'high' ? COLORS.red : COLORS.amber,
              }}
            >
              {inc.severity.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">{inc.time}</span>
          </div>
          <div className="font-bold text-sm text-slate-800 mb-1">{inc.type}</div>
          <div className="text-xs text-slate-500 mb-3">
            <div>Carer: {inc.carer}</div>
            <div>Client: {inc.client}</div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>Review</button>
            <button className="flex-1 py-2 rounded-lg text-xs font-semibold text-white border-none cursor-pointer" style={{ background: COLORS.navy }}>Escalate</button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div
        className="px-6 py-5 text-white shrink-0"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-teal/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold">Manager</div>
              <div className="text-xs text-white/50">Operations Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${sseConnected ? 'bg-teal/20 text-teal' : 'bg-white/10 text-white/50'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-teal animate-pulse' : 'bg-white/30'}`} />
              {sseConnected ? 'Live' : 'Offline'}
            </span>
            <button
              onClick={() => setLocation('/manager/login')}
              className="text-white/60 hover:text-white text-xs bg-transparent border-none cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 shrink-0 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {[
            { key: 'overview' as const, label: 'Overview' },
            { key: 'carers' as const, label: 'Carers' },
            { key: 'mar' as const, label: 'MAR' },
            { key: 'incidents' as const, label: 'Alerts' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors"
              style={{
                background: tab === t.key ? COLORS.darkNavy : 'transparent',
                color: tab === t.key ? 'white' : '#64748b',
              }}
            >
              {t.label}
              {t.key === 'incidents' && allIncidents.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-400 text-white">{allIncidents.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 overflow-auto">
        {tab === 'overview' && renderOverview()}
        {tab === 'carers' && renderCarers()}
        {tab === 'mar' && renderMAR()}
        {tab === 'incidents' && renderIncidents()}
      </div>
    </div>
  )
}
