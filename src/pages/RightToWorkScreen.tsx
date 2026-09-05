import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useParams } from 'wouter'
import {
  getCarers,
  getRightToWorkSummary,
  saveRightToWorkRecord,
  verifyRightToWork,
  rejectRightToWork,
  deleteRightToWorkRecord,
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

const CHECK_TYPES = ['British/Irish Passport', 'Share Code (EU Settlement)', 'Biometric Residence Permit', 'Visa & BRP', 'Other']

interface RtwRecord {
  id: string
  carerId: string
  carerName?: string
  checkType?: string
  passportNumber?: string
  passportExpiry?: string
  shareCode?: string
  shareCodeExpiry?: string
  nationality?: string
  visaType?: string
  visaExpiry?: string
  workRestriction?: string
  documentUrls?: string[]
  verificationStatus?: string
  verifiedBy?: string
  verifiedAt?: string
  expiryStatus?: string
  notes?: string
}

interface Carer { id: string; name: string }

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function getVerificationInfo(status?: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'verified': return { label: 'Verified', color: COLORS.green, bg: 'rgba(34,197,94,0.08)' }
    case 'pending': return { label: 'Pending', color: COLORS.amber, bg: 'rgba(246,183,60,0.08)' }
    case 'rejected': return { label: 'Rejected', color: COLORS.red, bg: 'rgba(255,90,95,0.08)' }
    default: return { label: 'Unknown', color: COLORS.g2, bg: 'rgba(148,163,184,0.08)' }
  }
}

function getExpiryInfo(status?: string): { label: string; color: string } | null {
  if (!status || status === 'valid') return null
  if (status === 'expired') return { label: 'Document Expired', color: COLORS.red }
  if (status === 'expiring') return { label: 'Expiring Soon', color: COLORS.amber }
  return null
}

export default function RightToWorkScreen() {
  const { slug } = useParams() as { slug?: string }
  const [, setLocation] = useLocation()
  const [carers, setCarers] = useState<Carer[]>([])
  const [records, setRecords] = useState<RtwRecord[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<RtwRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all')

  const [form, setForm] = useState({
    carerId: '',
    checkType: 'British/Irish Passport',
    passportNumber: '',
    passportExpiry: '',
    shareCode: '',
    shareCodeExpiry: '',
    nationality: '',
    visaType: '',
    visaExpiry: '',
    workRestriction: '',
    notes: '',
  })

  const basePath = slug ? `/tenant/${slug}` : ''

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [carerData, rtwData]: any[] = await Promise.all([
        getCarers(),
        getRightToWorkSummary(),
      ])
      setCarers(carerData?.carers || [])
      setRecords(rtwData?.records || [])
      setSummary(rtwData?.summary || null)
    } catch {
      setCarers([]); setRecords([])
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setEditingRecord(null)
    setForm({
      carerId: '', checkType: 'British/Irish Passport', passportNumber: '', passportExpiry: '',
      shareCode: '', shareCodeExpiry: '', nationality: '', visaType: '', visaExpiry: '',
      workRestriction: '', notes: '',
    })
    setShowForm(true)
  }

  function openEditForm(record: RtwRecord) {
    setEditingRecord(record)
    setForm({
      carerId: record.carerId,
      checkType: record.checkType || 'British/Irish Passport',
      passportNumber: record.passportNumber || '',
      passportExpiry: record.passportExpiry || '',
      shareCode: record.shareCode || '',
      shareCodeExpiry: record.shareCodeExpiry || '',
      nationality: record.nationality || '',
      visaType: record.visaType || '',
      visaExpiry: record.visaExpiry || '',
      workRestriction: record.workRestriction || '',
      notes: record.notes || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.carerId) { alert('Please select a carer'); return }
    const carer = carers.find((c) => c.id === form.carerId)
    setSaving(true)
    try {
      await saveRightToWorkRecord({
        id: editingRecord?.id,
        carerId: form.carerId,
        carerName: carer?.name,
        checkType: form.checkType,
        passportNumber: form.passportNumber || undefined,
        passportExpiry: form.passportExpiry || undefined,
        shareCode: form.shareCode || undefined,
        shareCodeExpiry: form.shareCodeExpiry || undefined,
        nationality: form.nationality || undefined,
        visaType: form.visaType || undefined,
        visaExpiry: form.visaExpiry || undefined,
        workRestriction: form.workRestriction || undefined,
        notes: form.notes || undefined,
      })
      await loadData()
      setShowForm(false)
    } catch { alert('Failed to save record') }
    finally { setSaving(false) }
  }

  async function handleVerify(id: string) {
    try { await verifyRightToWork(id); await loadData() }
    catch { alert('Failed to verify') }
  }

  async function handleReject(id: string) {
    if (!confirm('Reject this right-to-work check?')) return
    try { await rejectRightToWork(id); await loadData() }
    catch { alert('Failed to reject') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this record?')) return
    try { await deleteRightToWorkRecord(id); await loadData() }
    catch { alert('Failed to delete') }
  }

  const filteredRecords = records.filter((r) => {
    if (filter === 'all') return true
    return (r.verificationStatus || 'pending') === filter
  })

  const carersWithoutRecord = carers.filter((c) => !records.some((r) => r.carerId === c.id))

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
          <h1 className="font-serif text-lg font-bold">Right to Work</h1>
          <button
            onClick={openAddForm}
            className="text-xs font-semibold px-3 py-2 rounded-xl border-none cursor-pointer transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: 'white' }}
          >
            + Add Check
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <SummaryCard label="Total" value={String(summary.total)} color={COLORS.teal} />
            <SummaryCard label="Verified" value={String(summary.verified)} color={COLORS.green} />
            <SummaryCard label="Pending" value={String(summary.pending)} color={COLORS.amber} />
            <SummaryCard label="Rejected" value={String(summary.rejected)} color={COLORS.red} />
          </div>
        )}

        {/* Expiry Alert Banner */}
        {summary && (summary.expired > 0 || summary.expiring > 0) && (
          <div className="rounded-2xl p-3 mb-4" style={{
            background: summary.expired > 0 ? 'rgba(255,90,95,0.06)' : 'rgba(246,183,60,0.06)',
            border: `1px solid ${summary.expired > 0 ? 'rgba(255,90,95,0.15)' : 'rgba(246,183,60,0.15)'}`,
          }}>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={summary.expired > 0 ? COLORS.red : COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-xs font-semibold" style={{ color: summary.expired > 0 ? COLORS.red : COLORS.amber }}>
                {summary.expired > 0 ? `${summary.expired} expired document(s)` : `${summary.expiring} document(s) expiring soon`}
              </span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {[
            { key: 'all', label: `All (${records.length})` },
            { key: 'verified', label: `Verified (${summary?.verified || 0})` },
            { key: 'pending', label: `Pending (${summary?.pending || 0})` },
            { key: 'rejected', label: `Rejected (${summary?.rejected || 0})` },
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

        {/* Records List */}
        <div className="space-y-2">
          {filteredRecords.length === 0 && carersWithoutRecord.length === 0 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center text-xs text-slate-400">
              No right-to-work records found
            </div>
          )}

          {filteredRecords.map((record, i) => {
            const vInfo = getVerificationInfo(record.verificationStatus)
            const eInfo = getExpiryInfo(record.expiryStatus)
            const carer = carers.find((c) => c.id === record.carerId)
            return (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: vInfo.bg, color: vInfo.color }}>
                      {(record.carerName || carer?.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{record.carerName || carer?.name || 'Unknown'}</div>
                      <div className="text-[10px] text-slate-400">{record.checkType || 'Unknown check type'}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: vInfo.bg, color: vInfo.color }}>
                    {vInfo.label}
                  </span>
                </div>

                {/* Document Details */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 mb-2">
                  {record.nationality && <span>Nationality: <strong>{record.nationality}</strong></span>}
                  {record.passportNumber && <span>Passport: <strong>{record.passportNumber}</strong></span>}
                  {record.passportExpiry && <span>Passport exp: {new Date(record.passportExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  {record.shareCode && <span>Share code: <strong>{record.shareCode}</strong></span>}
                  {record.shareCodeExpiry && <span>Share code exp: {new Date(record.shareCodeExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  {record.visaType && <span>Visa: <strong>{record.visaType}</strong></span>}
                  {record.visaExpiry && <span>Visa exp: {new Date(record.visaExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </div>

                {/* Work Restriction */}
                {record.workRestriction && (
                  <div className="text-[10px] px-2 py-1 rounded-lg mb-2" style={{ background: 'rgba(167,139,250,0.08)', color: COLORS.lavender }}>
                    Work restriction: {record.workRestriction}
                  </div>
                )}

                {/* Expiry Alert */}
                {eInfo && (
                  <div className="text-[10px] font-medium px-2 py-1 rounded-lg mb-2" style={{ background: `${eInfo.color}0d`, color: eInfo.color }}>
                    {eInfo.label}
                  </div>
                )}

                {/* Verification Info */}
                {record.verifiedBy && record.verifiedAt && (
                  <div className="text-[10px] text-slate-400 mb-2">
                    {record.verificationStatus === 'verified' ? 'Verified' : 'Rejected'} by {record.verifiedBy} on {new Date(record.verifiedAt).toLocaleDateString('en-GB')}
                  </div>
                )}

                {record.notes && <div className="text-[10px] text-slate-400 mb-2">{record.notes}</div>}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openEditForm(record)} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border-none cursor-pointer transition-all" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>Edit</button>
                  {record.verificationStatus !== 'verified' && (
                    <button onClick={() => handleVerify(record.id)} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border-none cursor-pointer transition-all" style={{ background: 'rgba(34,197,94,0.08)', color: COLORS.green }}>Verify</button>
                  )}
                  {record.verificationStatus !== 'rejected' && (
                    <button onClick={() => handleReject(record.id)} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all hover:bg-red-50" style={{ borderColor: `${COLORS.red}20`, color: COLORS.red, background: 'transparent' }}>Reject</button>
                  )}
                  <button onClick={() => handleDelete(record.id)} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all hover:bg-slate-50" style={{ borderColor: 'rgba(0,0,0,0.08)', color: COLORS.g2, background: 'transparent' }}>Delete</button>
                </div>
              </motion.div>
            )
          })}

          {/* Carers without any RTW check */}
          {filter === 'all' && carersWithoutRecord.length > 0 && (
            <>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pt-2 pb-1">No Check on File</div>
              {carersWithoutRecord.map((carer) => (
                <div key={carer.id} className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(148,163,184,0.1)', color: COLORS.g2 }}>
                      {carer.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{carer.name}</div>
                      <div className="text-[10px]" style={{ color: COLORS.g2 }}>No right-to-work check</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingRecord(null)
                      setForm({ carerId: carer.id, checkType: 'British/Irish Passport', passportNumber: '', passportExpiry: '', shareCode: '', shareCodeExpiry: '', nationality: '', visaType: '', visaExpiry: '', workRestriction: '', notes: '' })
                      setShowForm(true)
                    }}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border-none cursor-pointer transition-all"
                    style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}
                  >
                    Add Check
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">{editingRecord ? 'Edit Right-to-Work Check' : 'Add Right-to-Work Check'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Carer *</label>
                <select value={form.carerId} onChange={(e) => setForm({ ...form, carerId: e.target.value })} disabled={!!editingRecord} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all disabled:opacity-60">
                  <option value="">Select a carer</option>
                  {carers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Check Type</label>
                <select value={form.checkType} onChange={(e) => setForm({ ...form, checkType: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all">
                  {CHECK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Nationality</label>
                <input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" placeholder="e.g. British, Irish, Polish" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Passport Number</label>
                  <input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" placeholder="e.g. 123456789" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Passport Expiry</label>
                  <input type="date" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Share Code (EUSS)</label>
                  <input value={form.shareCode} onChange={(e) => setForm({ ...form, shareCode: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" placeholder="e.g. ABC1234567" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Share Code Expiry</label>
                  <input type="date" value={form.shareCodeExpiry} onChange={(e) => setForm({ ...form, shareCodeExpiry: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Visa Type</label>
                  <input value={form.visaType} onChange={(e) => setForm({ ...form, visaType: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" placeholder="e.g. Skilled Worker" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Visa Expiry</label>
                  <input type="date" value={form.visaExpiry} onChange={(e) => setForm({ ...form, visaExpiry: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Work Restrictions</label>
                <input value={form.workRestriction} onChange={(e) => setForm({ ...form, workRestriction: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" placeholder="e.g. Max 20 hrs/week, No night shifts" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all resize-none" placeholder="Additional notes..." />
              </div>
              <button onClick={handleSave} disabled={saving || !form.carerId} className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 mt-2" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}>
                {saving ? 'Saving...' : editingRecord ? 'Update Check' : 'Save Check'}
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
