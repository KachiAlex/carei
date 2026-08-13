import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useParams } from 'wouter'
import {
  getCarers,
  getSupervisions,
  saveSupervision,
  completeSupervision,
  cancelSupervision,
  deleteSupervision,
} from '../api/client'

const COLORS = {
  darkNavy: '#0F1D34',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
  lavender: '#A78BFA',
  g2: '#94A3B8',
}

const MEETING_TYPES = ['supervision', 'appraisal', '1:1', 'team meeting', 'probation review']

const TYPE_ICONS: Record<string, string> = {
  'supervision': '📋',
  'appraisal': '⭐',
  '1:1': '💬',
  'team meeting': '👥',
  'probation review': '📝',
}

interface Meeting {
  id: string
  carerId: string
  carerName?: string
  managerId?: string
  managerName?: string
  type: string
  scheduledDate: string
  scheduledTime?: string
  durationMinutes?: number
  location?: string
  status: string
  agenda?: string
  notes?: string
  actionItems?: string[]
  rating?: number
  completedAt?: string
  createdAt?: string
}

interface Carer { id: string; name: string }

function getStatusInfo(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'scheduled': return { label: 'Scheduled', color: COLORS.teal, bg: 'rgba(79,209,197,0.08)' }
    case 'completed': return { label: 'Completed', color: COLORS.green, bg: 'rgba(34,197,94,0.08)' }
    case 'cancelled': return { label: 'Cancelled', color: COLORS.red, bg: 'rgba(255,90,95,0.08)' }
    case 'rescheduled': return { label: 'Rescheduled', color: COLORS.amber, bg: 'rgba(246,183,60,0.08)' }
    default: return { label: status, color: COLORS.g2, bg: 'rgba(148,163,184,0.08)' }
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SupervisionScreen() {
  const { slug } = useParams() as { slug?: string }
  const [, setLocation] = useLocation()
  const [carers, setCarers] = useState<Carer[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'completed' | 'cancelled'>('upcoming')
  const [completingId, setCompletingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    carerId: '',
    type: 'supervision',
    scheduledDate: '',
    scheduledTime: '10:00',
    durationMinutes: 60,
    location: '',
    agenda: '',
  })

  const [completeForm, setCompleteForm] = useState({
    notes: '',
    actionItems: '',
    rating: 3,
  })

  const basePath = slug ? `/tenant/${slug}` : ''

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [carerData, supData]: any[] = await Promise.all([
        getCarers(),
        getSupervisions(),
      ])
      setCarers(carerData?.carers || [])
      setMeetings(supData?.meetings || [])
      setSummary(supData?.summary || null)
    } catch {
      setCarers([]); setMeetings([])
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setEditingMeeting(null)
    setForm({
      carerId: '', type: 'supervision',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '10:00', durationMinutes: 60, location: '', agenda: '',
    })
    setShowForm(true)
  }

  function openEditForm(meeting: Meeting) {
    setEditingMeeting(meeting)
    setForm({
      carerId: meeting.carerId,
      type: meeting.type || 'supervision',
      scheduledDate: meeting.scheduledDate,
      scheduledTime: meeting.scheduledTime || '10:00',
      durationMinutes: meeting.durationMinutes || 60,
      location: meeting.location || '',
      agenda: meeting.agenda || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.carerId || !form.scheduledDate) { alert('Carer and date are required'); return }
    const carer = carers.find((c) => c.id === form.carerId)
    setSaving(true)
    try {
      await saveSupervision({
        id: editingMeeting?.id,
        carerId: form.carerId,
        carerName: carer?.name,
        type: form.type,
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime,
        durationMinutes: form.durationMinutes,
        location: form.location || undefined,
        agenda: form.agenda || undefined,
      })
      await loadData()
      setShowForm(false)
    } catch { alert('Failed to save meeting') }
    finally { setSaving(false) }
  }

  async function handleComplete() {
    if (!completingId) return
    setSaving(true)
    try {
      await completeSupervision(completingId, {
        notes: completeForm.notes || undefined,
        actionItems: completeForm.actionItems.split('\n').map((s) => s.trim()).filter(Boolean),
        rating: completeForm.rating,
      })
      await loadData()
      setCompletingId(null)
      setCompleteForm({ notes: '', actionItems: '', rating: 3 })
    } catch { alert('Failed to complete meeting') }
    finally { setSaving(false) }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this meeting?')) return
    try { await cancelSupervision(id); await loadData() }
    catch { alert('Failed to cancel') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this meeting record?')) return
    try { await deleteSupervision(id); await loadData() }
    catch { alert('Failed to delete') }
  }

  const filteredMeetings = meetings.filter((m) => {
    if (filter === 'upcoming') {
      const today = new Date().toISOString().split('T')[0]
      return m.scheduledDate >= today && (m.status === 'scheduled' || m.status === 'rescheduled')
    }
    if (filter === 'completed') return m.status === 'completed'
    if (filter === 'cancelled') return m.status === 'cancelled'
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button
          onClick={() => setLocation(`${basePath}/manager`)}
          className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-lg font-bold">Supervisions & Appraisals</h1>
          <button
            onClick={openAddForm}
            className="text-xs font-semibold px-3 py-2 rounded-xl border-none cursor-pointer transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: 'white' }}
          >
            + Schedule
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <SummaryCard label="Total" value={String(summary.total)} color={COLORS.teal} />
            <SummaryCard label="Upcoming" value={String(summary.upcoming)} color={COLORS.amber} />
            <SummaryCard label="Completed" value={String(summary.completed)} color={COLORS.green} />
            <SummaryCard label="Cancelled" value={String(summary.cancelled)} color={COLORS.red} />
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'all', label: 'All' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border-none cursor-pointer transition-all"
              style={{
                background: filter === tab.key ? COLORS.teal : 'white',
                color: filter === tab.key ? 'white' : '#64748b',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Meetings List */}
        <div className="space-y-2">
          {filteredMeetings.length === 0 ? (
            <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center text-xs text-slate-400">
              No meetings found
            </div>
          ) : (
            filteredMeetings.map((meeting, i) => {
              const statusInfo = getStatusInfo(meeting.status)
              const carer = carers.find((c) => c.id === meeting.carerId)
              return (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: `${COLORS.lavender}15` }}>
                        {TYPE_ICONS[meeting.type] || '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-700 capitalize truncate">{meeting.type}</div>
                        <div className="text-[11px] text-slate-500">{meeting.carerName || carer?.name || 'Unknown'}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-500 mb-2">
                    <span className="font-medium" style={{ color: COLORS.teal }}>{formatDate(meeting.scheduledDate)}</span>
                    {meeting.scheduledTime && <span>{meeting.scheduledTime}</span>}
                    {meeting.durationMinutes && <span>{meeting.durationMinutes} min</span>}
                    {meeting.location && <span>📍 {meeting.location}</span>}
                    {meeting.managerName && <span>with {meeting.managerName}</span>}
                  </div>

                  {meeting.agenda && (
                    <div className="text-[10px] text-slate-400 mb-2 line-clamp-2">{meeting.agenda}</div>
                  )}

                  {meeting.status === 'completed' && (
                    <>
                      {meeting.notes && (
                        <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg p-2 mb-2">{meeting.notes}</div>
                      )}
                      {meeting.actionItems && meeting.actionItems.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] font-semibold text-slate-400 mb-1">Action Items</div>
                          {meeting.actionItems.map((item, idx) => (
                            <div key={idx} className="text-[10px] text-slate-500 flex items-start gap-1.5">
                              <span style={{ color: COLORS.teal }}>•</span> {item}
                            </div>
                          ))}
                        </div>
                      )}
                      {meeting.rating != null && (
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-[10px] text-slate-400">Rating:</span>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className="text-[11px]" style={{ color: star <= meeting.rating! ? COLORS.amber : '#e2e8f0' }}>★</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {(meeting.status === 'scheduled' || meeting.status === 'rescheduled') && (
                      <>
                        <button onClick={() => openEditForm(meeting)} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border-none cursor-pointer transition-all" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>Edit</button>
                        <button onClick={() => { setCompletingId(meeting.id); setCompleteForm({ notes: '', actionItems: '', rating: 3 }) }} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border-none cursor-pointer transition-all" style={{ background: 'rgba(34,197,94,0.08)', color: COLORS.green }}>Complete</button>
                        <button onClick={() => handleCancel(meeting.id)} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all hover:bg-amber-50" style={{ borderColor: `${COLORS.amber}20`, color: COLORS.amber, background: 'transparent' }}>Cancel</button>
                      </>
                    )}
                    <button onClick={() => handleDelete(meeting.id)} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all hover:bg-red-50" style={{ borderColor: `${COLORS.red}20`, color: COLORS.red, background: 'transparent' }}>Delete</button>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Schedule Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">{editingMeeting ? 'Edit Meeting' : 'Schedule Meeting'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Carer *</label>
                <select value={form.carerId} onChange={(e) => setForm({ ...form, carerId: e.target.value })} disabled={!!editingMeeting} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all disabled:opacity-60">
                  <option value="">Select a carer</option>
                  {carers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Meeting Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all">
                  {MEETING_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Date *</label>
                  <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Time</label>
                  <input type="time" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Duration (min)</label>
                  <input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 60 })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" min={15} step={15} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Location</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" placeholder="e.g. Office, Zoom" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Agenda</label>
                <textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all resize-none" placeholder="Topics to discuss..." />
              </div>
              <button onClick={handleSave} disabled={saving || !form.carerId || !form.scheduledDate} className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 mt-2" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>
                {saving ? 'Saving...' : editingMeeting ? 'Update Meeting' : 'Schedule Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Meeting Modal */}
      {completingId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setCompletingId(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">Complete Meeting</h3>
              <button onClick={() => setCompletingId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setCompleteForm({ ...completeForm, rating: star })}
                      className="text-2xl bg-transparent border-none cursor-pointer transition-all hover:scale-110"
                      style={{ color: star <= completeForm.rating ? COLORS.amber : '#e2e8f0' }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
                <textarea value={completeForm.notes} onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all resize-none" placeholder="Meeting summary and discussion points..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Action Items (one per line)</label>
                <textarea value={completeForm.actionItems} onChange={(e) => setCompleteForm({ ...completeForm, actionItems: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all resize-none" placeholder="Complete training renewal&#10;Update care plan for client X&#10;Schedule next supervision" />
              </div>
              <button onClick={handleComplete} disabled={saving} className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 mt-2" style={{ background: `linear-gradient(135deg, ${COLORS.green}, #16a34a)` }}>
                {saving ? 'Saving...' : 'Mark as Completed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-sm text-center">
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-[9px] text-slate-400">{label}</div>
    </div>
  )
}
