import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useParams } from 'wouter'
import {
  getCarers,
  getDbsSummary,
  saveDbsRecord,
  deleteDbsRecord,
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

const DBS_TYPES = ['Standard', 'Enhanced', 'Enhanced with Barred List', 'Basic']

interface DbsRecord {
  id: string
  carerId: string
  carerName?: string
  dbsType?: string
  dbsNumber?: string
  issueDate?: string
  expiryDate?: string
  status?: string
  computedStatus?: string
  updateService?: boolean
  updateServiceLastChecked?: string
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

function getStatusInfo(record: DbsRecord): { label: string; color: string; bg: string } {
  const status = record.computedStatus || record.status || 'unknown'
  switch (status) {
    case 'valid':
      return { label: 'Valid', color: COLORS.green, bg: 'rgba(34,197,94,0.08)' }
    case 'expiring':
      return { label: 'Expiring Soon', color: COLORS.amber, bg: 'rgba(246,183,60,0.08)' }
    case 'expired':
      return { label: 'Expired', color: COLORS.red, bg: 'rgba(255,90,95,0.08)' }
    default:
      return { label: 'No DBS', color: COLORS.g2, bg: 'rgba(148,163,184,0.08)' }
  }
}

export default function DbsScreen() {
  const { slug } = useParams() as { slug?: string }
  const [, setLocation] = useLocation()
  const [carers, setCarers] = useState<Carer[]>([])
  const [records, setRecords] = useState<DbsRecord[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<DbsRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'valid' | 'expiring' | 'expired' | 'none'>('all')

  const [form, setForm] = useState({
    carerId: '',
    dbsType: 'Enhanced',
    dbsNumber: '',
    issueDate: '',
    expiryDate: '',
    updateService: false,
    notes: '',
  })

  const basePath = slug ? `/tenant/${slug}` : ''

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [carerData, dbsData]: any[] = await Promise.all([
        getCarers(),
        getDbsSummary(),
      ])
      setCarers(carerData?.carers || [])
      setRecords(dbsData?.records || [])
      setSummary(dbsData?.summary || null)
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
      carerId: '',
      dbsType: 'Enhanced',
      dbsNumber: '',
      issueDate: '',
      expiryDate: '',
      updateService: false,
      notes: '',
    })
    setShowForm(true)
  }

  function openEditForm(record: DbsRecord) {
    setEditingRecord(record)
    setForm({
      carerId: record.carerId,
      dbsType: record.dbsType || 'Enhanced',
      dbsNumber: record.dbsNumber || '',
      issueDate: record.issueDate || '',
      expiryDate: record.expiryDate || '',
      updateService: record.updateService || false,
      notes: record.notes || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.carerId) {
      alert('Please select a carer')
      return
    }
    const carer = carers.find((c) => c.id === form.carerId)
    setSaving(true)
    try {
      await saveDbsRecord({
        id: editingRecord?.id,
        carerId: form.carerId,
        carerName: carer?.name,
        dbsType: form.dbsType,
        dbsNumber: form.dbsNumber || undefined,
        issueDate: form.issueDate || undefined,
        expiryDate: form.expiryDate || undefined,
        updateService: form.updateService,
        notes: form.notes || undefined,
      })
      await loadData()
      setShowForm(false)
    } catch {
      alert('Failed to save DBS record')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this DBS record?')) return
    try {
      await deleteDbsRecord(id)
      await loadData()
    } catch {
      alert('Failed to delete record')
    }
  }

  // Carers without any DBS record
  const carersWithoutDbs = carers.filter((c) => !records.some((r) => r.carerId === c.id))

  const filteredRecords = records.filter((r) => {
    if (filter === 'all') return true
    const status = r.computedStatus || r.status || 'unknown'
    if (filter === 'none') return false
    return status === filter
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
          <h1 className="font-serif text-lg font-bold">DBS Compliance</h1>
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
        {/* Compliance Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <SummaryCard
              label="Compliance Rate"
              value={`${summary.complianceRate}%`}
              color={summary.complianceRate >= 80 ? COLORS.green : summary.complianceRate >= 50 ? COLORS.amber : COLORS.red}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
                </svg>
              }
            />
            <SummaryCard
              label="Total Records"
              value={String(summary.total)}
              color={COLORS.teal}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                </svg>
              }
            />
            <SummaryCard
              label="Expiring Soon"
              value={String(summary.expiring)}
              color={COLORS.amber}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
              }
            />
            <SummaryCard
              label="Expired"
              value={String(summary.expired)}
              color={COLORS.red}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
                </svg>
              }
            />
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {[
            { key: 'all', label: `All (${records.length})` },
            { key: 'valid', label: `Valid (${summary?.valid || 0})` },
            { key: 'expiring', label: `Expiring (${summary?.expiring || 0})` },
            { key: 'expired', label: `Expired (${summary?.expired || 0})` },
            { key: 'none', label: `No DBS (${carersWithoutDbs.length})` },
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
        {filter === 'none' ? (
          <div className="space-y-2">
            {carersWithoutDbs.length === 0 ? (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center text-xs text-slate-400">
                All carers have DBS records
              </div>
            ) : (
              carersWithoutDbs.map((carer) => (
                <motion.div
                  key={carer.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(148,163,184,0.1)', color: COLORS.g2 }}>
                      {carer.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{carer.name}</div>
                      <div className="text-[10px]" style={{ color: COLORS.g2 }}>No DBS on file</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingRecord(null)
                      setForm({ carerId: carer.id, dbsType: 'Enhanced', dbsNumber: '', issueDate: '', expiryDate: '', updateService: false, notes: '' })
                      setShowForm(true)
                    }}
                    className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border-none cursor-pointer transition-all"
                    style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}
                  >
                    Add DBS
                  </button>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecords.length === 0 ? (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center text-xs text-slate-400">
                No records in this category
              </div>
            ) : (
              filteredRecords.map((record, i) => {
                const statusInfo = getStatusInfo(record)
                const days = daysUntil(record.expiryDate)
                const carer = carers.find((c) => c.id === record.carerId)
                return (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${statusInfo.bg}`, color: statusInfo.color }}>
                          {(record.carerName || carer?.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-700">{record.carerName || carer?.name || 'Unknown'}</div>
                          <div className="text-[10px] text-slate-400">{record.dbsType || 'Standard'} {record.dbsNumber ? `· #${record.dbsNumber}` : ''}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-slate-500 mb-2">
                      {record.issueDate && (
                        <span>Issued: {new Date(record.issueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                      {record.expiryDate && (
                        <span>Expires: {new Date(record.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                      {record.updateService && (
                        <span className="font-medium" style={{ color: COLORS.green }}>Update Service ✓</span>
                      )}
                    </div>

                    {days != null && days >= 0 && days <= 90 && !record.updateService && (
                      <div className="text-[10px] font-medium px-2 py-1 rounded-lg mb-2" style={{ background: days < 0 ? 'rgba(255,90,95,0.06)' : 'rgba(246,183,60,0.06)', color: days < 0 ? COLORS.red : COLORS.amber }}>
                        {days < 0 ? `Expired ${Math.abs(days)} days ago` : `Renewal needed in ${days} days`}
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
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">{editingRecord ? 'Edit DBS Record' : 'Add DBS Record'}</h3>
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
                <label className="text-xs font-semibold text-slate-500 mb-1 block">DBS Type</label>
                <select
                  value={form.dbsType}
                  onChange={(e) => setForm({ ...form, dbsType: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                >
                  {DBS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">DBS Number</label>
                <input
                  value={form.dbsNumber}
                  onChange={(e) => setForm({ ...form, dbsNumber: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all"
                  placeholder="e.g. 001234567890"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Issue Date</label>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
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
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={form.updateService}
                  onChange={(e) => setForm({ ...form, updateService: e.target.checked })}
                  className="w-4 h-4 rounded accent-teal-500"
                />
                <span className="text-sm text-slate-600">Registered with Update Service</span>
              </label>
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
                disabled={saving || !form.carerId}
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

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  )
}
