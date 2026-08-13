import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useParams } from 'wouter'
import {
  getCarers,
  getTrainingSummary,
  saveTrainingRecord,
  deleteTrainingRecord,
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

const CATEGORIES = ['Mandatory', 'Clinical', 'Safety', 'Safeguarding', 'Infection Control', 'Dementia Care', 'First Aid', 'Moving & Handling', 'Other']

const CATEGORY_COLORS: Record<string, string> = {
  'Mandatory': COLORS.teal,
  'Clinical': COLORS.lavender,
  'Safety': COLORS.amber,
  'Safeguarding': COLORS.red,
  'Infection Control': '#3b82f6',
  'Dementia Care': '#ec4899',
  'First Aid': COLORS.green,
  'Moving & Handling': '#8b5cf6',
  'Other': COLORS.g2,
}

interface TrainingRecord {
  id: string
  carerId: string
  carerName?: string
  courseName: string
  category?: string
  provider?: string
  completionDate?: string
  expiryDate?: string
  certificateNumber?: string
  status?: string
  computedStatus?: string
  score?: string
  notes?: string
  documentUrl?: string
}

interface Carer {
  id: string
  name: string
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getStatusInfo(record: TrainingRecord): { label: string; color: string; bg: string } {
  const status = record.computedStatus || record.status || 'valid'
  switch (status) {
    case 'valid':
      return { label: 'Valid', color: COLORS.green, bg: 'rgba(34,197,94,0.08)' }
    case 'expiring':
      return { label: 'Expiring', color: COLORS.amber, bg: 'rgba(246,183,60,0.08)' }
    case 'expired':
      return { label: 'Expired', color: COLORS.red, bg: 'rgba(255,90,95,0.08)' }
    default:
      return { label: 'Unknown', color: COLORS.g2, bg: 'rgba(148,163,184,0.08)' }
  }
}

export default function TrainingScreen() {
  const { slug } = useParams() as { slug?: string }
  const [, setLocation] = useLocation()
  const [carers, setCarers] = useState<Carer[]>([])
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TrainingRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'valid' | 'expiring' | 'expired'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [form, setForm] = useState({
    carerId: '',
    courseName: '',
    category: 'Mandatory',
    provider: '',
    completionDate: '',
    expiryDate: '',
    certificateNumber: '',
    score: '',
    notes: '',
  })

  const basePath = slug ? `/tenant/${slug}` : ''

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [carerData, trainData]: any[] = await Promise.all([
        getCarers(),
        getTrainingSummary(),
      ])
      setCarers(carerData?.carers || [])
      setRecords(trainData?.records || [])
      setSummary(trainData?.summary || null)
    } catch {
      setCarers([])
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setEditingRecord(null)
    setForm({
      carerId: '', courseName: '', category: 'Mandatory', provider: '',
      completionDate: '', expiryDate: '', certificateNumber: '', score: '', notes: '',
    })
    setShowForm(true)
  }

  function openEditForm(record: TrainingRecord) {
    setEditingRecord(record)
    setForm({
      carerId: record.carerId,
      courseName: record.courseName,
      category: record.category || 'Mandatory',
      provider: record.provider || '',
      completionDate: record.completionDate || '',
      expiryDate: record.expiryDate || '',
      certificateNumber: record.certificateNumber || '',
      score: record.score || '',
      notes: record.notes || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.carerId || !form.courseName) {
      alert('Carer and course name are required')
      return
    }
    const carer = carers.find((c) => c.id === form.carerId)
    setSaving(true)
    try {
      await saveTrainingRecord({
        id: editingRecord?.id,
        carerId: form.carerId,
        carerName: carer?.name,
        courseName: form.courseName,
        category: form.category,
        provider: form.provider || undefined,
        completionDate: form.completionDate || undefined,
        expiryDate: form.expiryDate || undefined,
        certificateNumber: form.certificateNumber || undefined,
        score: form.score || undefined,
        notes: form.notes || undefined,
      })
      await loadData()
      setShowForm(false)
    } catch {
      alert('Failed to save training record')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this training record?')) return
    try {
      await deleteTrainingRecord(id)
      await loadData()
    } catch {
      alert('Failed to delete record')
    }
  }

  const filteredRecords = records.filter((r) => {
    const status = r.computedStatus || r.status || 'valid'
    if (filter !== 'all' && status !== filter) return false
    if (categoryFilter !== 'all' && (r.category || 'Uncategorized') !== categoryFilter) return false
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
          <h1 className="font-serif text-lg font-bold">Training & Certification</h1>
          <button
            onClick={openAddForm}
            className="text-xs font-semibold px-3 py-2 rounded-xl border-none cursor-pointer transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: 'white' }}
          >
            + Add Record
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <SummaryCard label="Total" value={String(summary.total)} color={COLORS.teal} />
            <SummaryCard label="Valid" value={String(summary.valid)} color={COLORS.green} />
            <SummaryCard label="Expiring" value={String(summary.expiring)} color={COLORS.amber} />
            <SummaryCard label="Expired" value={String(summary.expired)} color={COLORS.red} />
          </div>
        )}

        {/* Category Breakdown */}
        {summary?.byCategory && Object.keys(summary.byCategory).length > 0 && (
          <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm mb-4">
            <div className="text-xs font-bold text-slate-700 mb-2">By Category</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.byCategory).map(([cat, count]) => (
                <div
                  key={cat}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium"
                  style={{ background: `${CATEGORY_COLORS[cat] || COLORS.g2}15`, color: CATEGORY_COLORS[cat] || COLORS.g2 }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[cat] || COLORS.g2 }} />
                  {cat} ({count as number})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {[
            { key: 'all', label: 'All' },
            { key: 'valid', label: 'Valid' },
            { key: 'expiring', label: 'Expiring' },
            { key: 'expired', label: 'Expired' },
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

        {/* Category Filter */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          <button
            onClick={() => setCategoryFilter('all')}
            className="px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap border-none cursor-pointer transition-all"
            style={{
              background: categoryFilter === 'all' ? COLORS.navy : 'white',
              color: categoryFilter === 'all' ? 'white' : '#64748b',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap border-none cursor-pointer transition-all"
              style={{
                background: categoryFilter === cat ? (CATEGORY_COLORS[cat] || COLORS.g2) : 'white',
                color: categoryFilter === cat ? 'white' : '#64748b',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Records List */}
        <div className="space-y-2">
          {filteredRecords.length === 0 ? (
            <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center text-xs text-slate-400">
              No training records found
            </div>
          ) : (
            filteredRecords.map((record, i) => {
              const statusInfo = getStatusInfo(record)
              const days = daysUntil(record.expiryDate)
              const catColor = CATEGORY_COLORS[record.category || ''] || COLORS.g2
              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-700 truncate">{record.courseName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{record.carerName || 'Unknown carer'}</div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {record.category && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${catColor}15`, color: catColor }}>
                        {record.category}
                      </span>
                    )}
                    {record.provider && (
                      <span className="text-[10px] text-slate-400">{record.provider}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-slate-500 mb-2">
                    {record.completionDate && (
                      <span>Completed: {new Date(record.completionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    )}
                    {record.expiryDate && (
                      <span>Expires: {new Date(record.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    )}
                    {record.score && (
                      <span className="font-medium" style={{ color: COLORS.teal }}>Score: {record.score}</span>
                    )}
                  </div>

                  {days != null && days <= 60 && (
                    <div className="text-[10px] font-medium px-2 py-1 rounded-lg mb-2" style={{ background: days < 0 ? 'rgba(255,90,95,0.06)' : 'rgba(246,183,60,0.06)', color: days < 0 ? COLORS.red : COLORS.amber }}>
                      {days < 0 ? `Expired ${Math.abs(days)} days ago — renewal needed` : `Renewal needed in ${days} days`}
                    </div>
                  )}

                  {record.notes && (
                    <div className="text-[10px] text-slate-400 mb-2">{record.notes}</div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditForm(record)}
                      className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border-none cursor-pointer transition-all"
                      style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all hover:bg-red-50"
                      style={{ borderColor: `${COLORS.red}20`, color: COLORS.red, background: 'transparent' }}
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">{editingRecord ? 'Edit Training Record' : 'Add Training Record'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Carer *</label>
                <select
                  value={form.carerId}
                  onChange={(e) => setForm({ ...form, carerId: e.target.value })}
                  disabled={!!editingRecord}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all disabled:opacity-60"
                >
                  <option value="">Select a carer</option>
                  {carers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Course Name *</label>
                <input
                  value={form.courseName}
                  onChange={(e) => setForm({ ...form, courseName: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                  placeholder="e.g. Moving & Handling Training"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Provider</label>
                  <input
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                    placeholder="e.g. Red Cross"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Completion Date</label>
                  <input
                    type="date"
                    value={form.completionDate}
                    onChange={(e) => setForm({ ...form, completionDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Expiry Date</label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Certificate Number</label>
                  <input
                    value={form.certificateNumber}
                    onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                    placeholder="e.g. CERT-2024-001"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Score / Grade</label>
                  <input
                    value={form.score}
                    onChange={(e) => setForm({ ...form, score: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                    placeholder="e.g. 95% or Pass"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all resize-none"
                  placeholder="Additional notes..."
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !form.carerId || !form.courseName}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 mt-2"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                {saving ? 'Saving...' : editingRecord ? 'Update Record' : 'Save Record'}
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
