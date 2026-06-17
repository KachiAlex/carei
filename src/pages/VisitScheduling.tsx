import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'wouter'
import { useTenant } from '../contexts/TenantContext'
import { getScheduledVisits, createScheduledVisit, updateScheduledVisit, deleteScheduledVisit, getClients, getCarers } from '../api/client'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  amber: '#F6B73C',
  red: '#FF5A5F',
  lavender: '#A78BFA',
}

interface ScheduledVisit {
  id: string
  clientId: string
  clientName: string
  carerId?: string
  carerName?: string
  time: string
  duration: string
  status: string
  tasks: string[]
  flags: string[]
  recurring: string
  visitDate: string
}

interface Client {
  id: string
  name: string
}


function generateId() {
  return 'v' + Math.random().toString(36).slice(2, 9)
}

function formatDateKey(d: Date) {
  return d.toISOString().split('T')[0]
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days = []
  const startOffset = firstDay.getDay()
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i))
  return days
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEK_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function VisitScheduling() {
  const [, setLocation] = useLocation()
  const { currentTenant } = useTenant()
  const [today] = useState(new Date())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(today))
  const [visits, setVisits] = useState<ScheduledVisit[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [carers, setCarers] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    clientId: '',
    carerId: '',
    time: '09:00',
    duration: '1 hr',
    tasks: '',
    flags: '',
    recurring: 'none',
  })

  useEffect(() => {
    loadData()
  }, [viewYear, viewMonth])

  const loadData = async () => {
    setLoading(true)
    try {
      const from = formatDateKey(new Date(viewYear, viewMonth, 1))
      const to = formatDateKey(new Date(viewYear, viewMonth + 1, 0))
      const [scheduleData, clientData, carerData] = await Promise.all([
        getScheduledVisits(from, to),
        getClients(),
        getCarers(),
      ])
      setVisits(scheduleData.visits || [])
      setClients(clientData || [])
      setCarers(carerData?.carers || [])
    } catch {
      setVisits([])
      setClients([])
      setCarers([])
    } finally {
      setLoading(false)
    }
  }

  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth])

  const visitsByDate = useMemo(() => {
    const map: Record<string, ScheduledVisit[]> = {}
    visits.forEach((v) => {
      const d = v.visitDate
      if (!map[d]) map[d] = []
      map[d].push(v)
    })
    return map
  }, [visits])

  const selectedVisits = visitsByDate[selectedDate] || []

  const resetForm = () => {
    setForm({ clientId: '', carerId: '', time: '09:00', duration: '1 hr', tasks: '', flags: '', recurring: 'none' })
  }

  const openAdd = (date?: string) => {
    resetForm()
    setEditingId(null)
    if (date) setSelectedDate(date)
    setShowForm(true)
  }

  const openEdit = (visit: ScheduledVisit) => {
    setForm({
      clientId: visit.clientId || '',
      carerId: visit.carerId || '',
      time: visit.time || '09:00',
      duration: visit.duration || '1 hr',
      tasks: Array.isArray(visit.tasks) ? visit.tasks.join(', ') : '',
      flags: Array.isArray(visit.flags) ? visit.flags.join(', ') : '',
      recurring: visit.recurring || 'none',
    })
    setEditingId(visit.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    const client = clients.find((c) => c.id === form.clientId)
    const carer = carers.find((c) => c.id === form.carerId)
    if (!client) return
    setSaving(true)
    const payload = {
      clientId: client.id,
      clientName: client.name,
      carerId: carer?.id,
      carerName: carer?.name,
      time: form.time,
      duration: form.duration,
      tasks: form.tasks.split(',').map((t) => t.trim()).filter(Boolean),
      flags: form.flags.split(',').map((f) => f.trim()).filter(Boolean),
      recurring: form.recurring,
      visitDate: selectedDate,
    }
    try {
      if (editingId) {
        await updateScheduledVisit(editingId, payload)
      } else {
        await createScheduledVisit({ id: generateId(), ...payload })
      }
      await loadData()
      setShowForm(false)
      resetForm()
    } catch {
      alert('Failed to save visit')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteScheduledVisit(deletingId)
      await loadData()
      setDeletingId(null)
    } catch {
      alert('Failed to delete visit')
    }
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-6 pt-5 pb-5 text-white shrink-0 relative overflow-hidden" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-15 pointer-events-none" style={{ background: COLORS.teal }} />
        <div className="relative z-10 flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <button onClick={() => currentTenant && setLocation(`/tenant/${currentTenant.slug}/manager`)} className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer touch-target">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div>
              <div className="text-sm font-bold">Visit Scheduling</div>
              <div className="text-[11px] text-white/40">{visits.length} visits this month</div>
            </div>
          </div>
          <button onClick={() => openAdd()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Schedule Visit
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer touch-target">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div className="font-bold text-sm text-slate-800">{MONTH_NAMES[viewMonth]} {viewYear}</div>
            <button onClick={nextMonth} className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer touch-target">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="aspect-square" />
              const key = formatDateKey(day)
              const isSelected = key === selectedDate
              const isToday = key === formatDateKey(today)
              const dayVisits = visitsByDate[key] || []
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer border-none"
                  style={{
                    background: isSelected ? `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` : isToday ? 'rgba(79,209,197,0.08)' : 'transparent',
                    color: isSelected ? 'white' : isToday ? COLORS.teal : '#334155',
                  }}
                >
                  <span className="text-xs font-semibold">{day.getDate()}</span>
                  {dayVisits.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayVisits.slice(0, 3).map((v, idx) => (
                        <span key={idx} className="w-1 h-1 rounded-full" style={{ background: isSelected ? 'white' : COLORS.teal }} />
                      ))}
                      {dayVisits.length > 3 && <span className="w-1 h-1 rounded-full" style={{ background: isSelected ? 'white' : COLORS.amber }} />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selected Date Visits */}
      <div className="flex-1 px-4 pb-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-800">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <button onClick={() => openAdd(selectedDate)} className="text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg bg-transparent border-none cursor-pointer" style={{ color: COLORS.teal }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add
          </button>
        </div>
        {loading ? (
          <div className="flex flex-col gap-2 animate-pulse">
            {[1, 2].map((i) => <div key={i} className="bg-white rounded-xl p-3 h-16 border border-slate-100 shadow-sm" />)}
          </div>
        ) : selectedVisits.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            </div>
            <div className="text-xs text-slate-400">No visits scheduled for this day</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {selectedVisits.map((visit) => (
              <div key={visit.id} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.darkNavy})` }}>
                  {visit.clientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{visit.clientName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: visit.status === 'completed' ? 'rgba(79,209,197,0.1)' : visit.status === 'in-progress' ? 'rgba(246,183,60,0.1)' : '#f1f5f9', color: visit.status === 'completed' ? COLORS.teal : visit.status === 'in-progress' ? COLORS.amber : '#94a3b8', border: `1px solid ${visit.status === 'completed' ? 'rgba(79,209,197,0.15)' : visit.status === 'in-progress' ? 'rgba(246,183,60,0.15)' : 'transparent'}` }}>
                      {visit.status}
                    </span>
                    {visit.recurring !== 'none' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(167,139,250,0.1)', color: COLORS.lavender, border: '1px solid rgba(167,139,250,0.15)' }}>
                        {visit.recurring}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{visit.time} · {visit.duration} {visit.carerName ? `· ${visit.carerName}` : ''}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(visit)} className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer touch-target">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button onClick={() => setDeletingId(visit.id)} className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all bg-transparent border-none cursor-pointer touch-target">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">{editingId ? 'Edit Visit' : 'Schedule Visit'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Client *</label>
                <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all">
                  <option value="">Select a client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Assigned Carer</label>
                  <select value={form.carerId} onChange={(e) => setForm((f) => ({ ...f, carerId: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all">
                    <option value="">Unassigned</option>
                    {carers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Recurrence</label>
                  <select value={form.recurring} onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all">
                    <option value="none">One-off</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Time</label>
                  <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Duration</label>
                  <input value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all" placeholder="e.g. 1 hr" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Tasks (comma separated)</label>
                <input value={form.tasks} onChange={(e) => setForm((f) => ({ ...f, tasks: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all" placeholder="e.g. Personal care, Medication, Breakfast" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Flags (comma separated)</label>
                <input value={form.flags} onChange={(e) => setForm((f) => ({ ...f, flags: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all" placeholder="e.g. Dementia risk, Sundowning" />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !form.clientId}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 mt-2"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                {saving ? 'Saving...' : editingId ? 'Update Visit' : 'Schedule Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(255,90,95,0.1)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </div>
            <h3 className="font-bold text-base text-slate-800 text-center mb-1">Delete Visit?</h3>
            <p className="text-xs text-slate-500 text-center mb-4">This will permanently remove the scheduled visit. This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer hover:bg-slate-50 transition-all" style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}>Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90" style={{ background: COLORS.red }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
