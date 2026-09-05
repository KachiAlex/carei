import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useParams } from 'wouter'
import {
  getCarers,
  getAvailability,
  saveAvailabilitySlot,
  deleteAvailabilitySlot,
  createLeaveRequest,
  reviewLeaveRequest,
  deleteLeaveRequest,
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
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Unpaid Leave', 'Compassionate Leave', 'Training', 'Other']
const LEAVE_TYPE_COLORS: Record<string, string> = {
  'Annual Leave': COLORS.teal,
  'Sick Leave': COLORS.red,
  'Unpaid Leave': COLORS.amber,
  'Compassionate Leave': COLORS.lavender,
  'Training': '#3b82f6',
  'Other': '#94a3b8',
}

interface Carer {
  id: string
  name: string
  avatar?: string
}

interface AvailabilitySlot {
  id: string
  carerId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface LeaveRequest {
  id: string
  carerId: string
  carerName?: string
  leaveType: string
  startDate: string
  endDate: string
  reason?: string
  status: string
  reviewedBy?: string
  createdAt: string
}

export default function AvailabilityScreen() {
  const { slug } = useParams() as { slug?: string }
  const [, setLocation] = useLocation()
  const [carers, setCarers] = useState<Carer[]>([])
  const [selectedCarer, setSelectedCarer] = useState<string>('')
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'availability' | 'leave'>('availability')
  const [userRole, setUserRole] = useState<string>('')

  // Leave request form
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'Annual Leave',
    startDate: '',
    endDate: '',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('carei_user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        setUserRole(user.role || 'carer')
        if (user.role === 'carer' || user.role === 'caregiver') {
          setSelectedCarer(user.id)
        }
      } catch {}
    }
    loadCarers()
  }, [])

  useEffect(() => {
    if (selectedCarer) loadData()
  }, [selectedCarer])

  async function loadCarers() {
    try {
      const data: any = await getCarers()
      const list = data?.carers || []
      setCarers(list)
      if (list.length > 0 && !selectedCarer) {
        // Don't auto-select if user is a carer (already set above)
        if (userRole !== 'carer' && userRole !== 'caregiver') {
          setSelectedCarer(list[0].id)
        }
      }
    } catch {}
    setLoading(false)
  }

  async function loadData() {
    try {
      const [availData, leaveData] = await Promise.all([
        getAvailability(selectedCarer, 'availability').catch(() => ({ availability: [] })),
        getAvailability(selectedCarer, 'leave').catch(() => ({ leaveRequests: [] })),
      ])
      setAvailability((availData as any)?.availability || [])
      setLeaveRequests((leaveData as any)?.leaveRequests || [])

      // Managers also load all leave requests
      if (userRole === 'manager' || userRole === 'admin') {
        const allLeave: any = await getAvailability(undefined, 'leave').catch(() => ({ leaveRequests: [] }))
        setAllLeaveRequests(allLeave?.leaveRequests || [])
      }
    } catch {}
  }

  function getSlotsForDay(day: number): AvailabilitySlot[] {
    return availability.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  async function handleAddSlot(dayOfWeek: number) {
    const startTime = '09:00'
    const endTime = '17:00'
    try {
      await saveAvailabilitySlot({ carerId: selectedCarer, dayOfWeek, startTime, endTime })
      await loadData()
    } catch (err) {
      alert('Failed to save availability slot')
    }
  }

  async function handleUpdateSlot(slot: AvailabilitySlot, field: 'startTime' | 'endTime' | 'isAvailable', value: string | boolean) {
    try {
      await saveAvailabilitySlot({
        carerId: slot.carerId,
        dayOfWeek: slot.dayOfWeek,
        startTime: field === 'startTime' ? value as string : slot.startTime,
        endTime: field === 'endTime' ? value as string : slot.endTime,
        isAvailable: field === 'isAvailable' ? value as boolean : slot.isAvailable,
        slotId: slot.id,
      })
      await loadData()
    } catch {}
  }

  async function handleDeleteSlot(slotId: string) {
    try {
      await deleteAvailabilitySlot(slotId)
      await loadData()
    } catch {}
  }

  async function handleSubmitLeave() {
    if (!leaveForm.startDate || !leaveForm.endDate) {
      alert('Please select start and end dates')
      return
    }
    const carer = carers.find((c) => c.id === selectedCarer)
    setSubmitting(true)
    try {
      await createLeaveRequest({
        carerId: selectedCarer,
        carerName: carer?.name,
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason || undefined,
      })
      setLeaveForm({ leaveType: 'Annual Leave', startDate: '', endDate: '', reason: '' })
      await loadData()
    } catch {
      alert('Failed to submit leave request')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReviewLeave(leaveId: string, decision: 'approve' | 'reject') {
    try {
      await reviewLeaveRequest(leaveId, decision)
      await loadData()
    } catch {
      alert('Failed to review leave request')
    }
  }

  async function handleDeleteLeave(leaveId: string) {
    try {
      await deleteLeaveRequest(leaveId)
      await loadData()
    } catch {}
  }

  const isManager = userRole === 'manager' || userRole === 'admin'
  const isCarer = userRole === 'carer' || userRole === 'caregiver'
  const basePath = slug ? `/tenant/${slug}` : ''

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
          onClick={() => setLocation(isManager ? `${basePath}/manager` : `${basePath}/dashboard`)}
          className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <h1 className="font-serif text-lg font-bold">Availability & Leave</h1>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Carer selector (managers only) */}
        {isManager && carers.length > 0 && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Select Carer</label>
            <select
              value={selectedCarer}
              onChange={(e) => setSelectedCarer(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-white border border-slate-200 outline-none focus:border-teal transition-all"
            >
              {carers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('availability')}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all"
            style={{
              background: tab === 'availability' ? `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` : 'white',
              color: tab === 'availability' ? 'white' : '#64748b',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            Weekly Availability
          </button>
          <button
            onClick={() => setTab('leave')}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all"
            style={{
              background: tab === 'leave' ? `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` : 'white',
              color: tab === 'leave' ? 'white' : '#64748b',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            Leave Requests
          </button>
        </div>

        {/* Availability Tab */}
        {tab === 'availability' && selectedCarer && (
          <div className="space-y-2">
            {DAYS.map((dayName, dayIdx) => {
              const slots = getSlotsForDay(dayIdx)
              return (
                <motion.div
                  key={dayIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dayIdx * 0.03 }}
                  className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">{dayName}</span>
                    <button
                      onClick={() => handleAddSlot(dayIdx)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg border-none cursor-pointer transition-all"
                      style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}
                    >
                      + Add Slot
                    </button>
                  </div>
                  {slots.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-1">No availability set</div>
                  ) : (
                    <div className="space-y-1.5">
                      {slots.map((slot) => (
                        <div key={slot.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                          <button
                            onClick={() => handleUpdateSlot(slot, 'isAvailable', !slot.isAvailable)}
                            className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                            style={{
                              borderColor: slot.isAvailable ? COLORS.green : '#cbd5e1',
                              background: slot.isAvailable ? COLORS.green : 'transparent',
                            }}
                          >
                            {slot.isAvailable && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            )}
                          </button>
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => handleUpdateSlot(slot, 'startTime', e.target.value)}
                            className="px-2 py-1 rounded-lg text-xs bg-white border border-slate-200 outline-none focus:border-teal"
                          />
                          <span className="text-[10px] text-slate-400">to</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => handleUpdateSlot(slot, 'endTime', e.target.value)}
                            className="px-2 py-1 rounded-lg text-xs bg-white border border-slate-200 outline-none focus:border-teal"
                          />
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-auto"
                            style={{
                              background: slot.isAvailable ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.08)',
                              color: slot.isAvailable ? COLORS.green : '#94a3b8',
                            }}
                          >
                            {slot.isAvailable ? 'Available' : 'Unavailable'}
                          </span>
                          <button
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer border-none transition-all hover:bg-red-50"
                            style={{ background: 'transparent' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Leave Tab */}
        {tab === 'leave' && selectedCarer && (
          <div className="space-y-4">
            {/* Submit leave request form */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="text-sm font-bold text-slate-700 mb-3">Request Leave</div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 mb-1 block">Leave Type</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                  >
                    {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 mb-1 block">Start Date</label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 mb-1 block">End Date</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      min={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 mb-1 block">Reason (optional)</label>
                  <textarea
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all resize-none"
                    placeholder="Brief reason for leave..."
                  />
                </div>
                <button
                  onClick={handleSubmitLeave}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                >
                  {submitting ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </div>

            {/* My leave requests */}
            <div>
              <div className="text-sm font-bold text-slate-700 mb-2">My Leave Requests</div>
              {leaveRequests.length === 0 ? (
                <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center text-xs text-slate-400">
                  No leave requests yet
                </div>
              ) : (
                <div className="space-y-2">
                  {leaveRequests.map((lr) => (
                    <LeaveCard key={lr.id} leave={lr} onDelete={handleDeleteLeave} onReview={isManager ? handleReviewLeave : undefined} />
                  ))}
                </div>
              )}
            </div>

            {/* All leave requests (managers only) */}
            {isManager && allLeaveRequests.length > 0 && (
              <div>
                <div className="text-sm font-bold text-slate-700 mb-2">All Pending Leave Requests</div>
                <div className="space-y-2">
                  {allLeaveRequests.filter((l) => l.status === 'pending' && l.carerId !== selectedCarer).map((lr) => (
                    <LeaveCard key={lr.id} leave={lr} onReview={handleReviewLeave} showCarerName />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LeaveCard({
  leave,
  onDelete,
  onReview,
  showCarerName,
}: {
  leave: LeaveRequest
  onDelete?: (id: string) => void
  onReview?: (id: string, decision: 'approve' | 'reject') => void
  showCarerName?: boolean
}) {
  const color = LEAVE_TYPE_COLORS[leave.leaveType] || '#94a3b8'
  const statusColor = leave.status === 'approved' ? COLORS.green : leave.status === 'rejected' ? COLORS.red : COLORS.amber
  const statusBg = leave.status === 'approved' ? 'rgba(34,197,94,0.08)' : leave.status === 'rejected' ? 'rgba(255,90,95,0.08)' : 'rgba(246,183,60,0.08)'

  return (
    <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-sm font-semibold text-slate-700">{leave.leaveType}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: statusBg, color: statusColor }}>
          {leave.status}
        </span>
      </div>
      {showCarerName && leave.carerName && (
        <div className="text-[11px] text-slate-500 mb-1">{leave.carerName}</div>
      )}
      <div className="text-xs text-slate-600">
        {new Date(leave.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        {' — '}
        {new Date(leave.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </div>
      {leave.reason && (
        <div className="text-[11px] text-slate-400 mt-1">{leave.reason}</div>
      )}
      <div className="flex gap-2 mt-2">
        {onReview && leave.status === 'pending' && (
          <>
            <button
              onClick={() => onReview(leave.id, 'approve')}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90"
              style={{ background: COLORS.green }}
            >
              Approve
            </button>
            <button
              onClick={() => onReview(leave.id, 'reject')}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold border cursor-pointer transition-all hover:bg-red-50"
              style={{ borderColor: `${COLORS.red}30`, color: COLORS.red, background: 'transparent' }}
            >
              Reject
            </button>
          </>
        )}
        {onDelete && leave.status !== 'approved' && (
          <button
            onClick={() => onDelete(leave.id)}
            className="ml-auto text-[10px] text-slate-400 hover:text-red-500 cursor-pointer border-none bg-transparent"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
