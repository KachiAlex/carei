import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { useTenant } from '../contexts/TenantContext'
import { getClients, createClient, updateClient, deleteClient } from '../api/client'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  amber: '#F6B73C',
  red: '#FF5A5F',
  lavender: '#A78BFA',
}

interface Medication {
  name: string
  dose: string
  frequency: string
}

interface Client {
  id: string
  name: string
  age: number
  address: string
  conditions: string[]
  medications: Medication[]
  preferences: string
  emergency_contact: string
}

function generateId() {
  return 'c' + Math.random().toString(36).slice(2, 9)
}

export default function ClientManagement() {
  const [, setLocation] = useLocation()
  const { currentTenant } = useTenant()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    age: '',
    address: '',
    conditions: '',
    medications: [{ name: '', dose: '', frequency: '' }],
    preferences: '',
    emergencyContact: '',
  })

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    setLoading(true)
    try {
      const data = await getClients()
      setClients(data)
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({
      name: '',
      age: '',
      address: '',
      conditions: '',
      medications: [{ name: '', dose: '', frequency: '' }],
      preferences: '',
      emergencyContact: '',
    })
  }

  const openAdd = () => {
    resetForm()
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (client: Client) => {
    setForm({
      name: client.name,
      age: String(client.age || ''),
      address: client.address || '',
      conditions: Array.isArray(client.conditions) ? client.conditions.join(', ') : '',
      medications: Array.isArray(client.medications) && client.medications.length
        ? client.medications.map((m) => ({ name: m.name, dose: m.dose, frequency: m.frequency }))
        : [{ name: '', dose: '', frequency: '' }],
      preferences: client.preferences || '',
      emergencyContact: client.emergency_contact || '',
    })
    setEditingId(client.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      age: form.age ? Number(form.age) : undefined,
      address: form.address.trim() || undefined,
      conditions: form.conditions.split(',').map((c) => c.trim()).filter(Boolean),
      medications: form.medications.filter((m) => m.name.trim()),
      preferences: form.preferences.trim() || undefined,
      emergencyContact: form.emergencyContact.trim() || undefined,
    }
    try {
      if (editingId) {
        await updateClient(editingId, payload)
      } else {
        await createClient({ id: generateId(), ...payload })
      }
      await loadClients()
      setShowForm(false)
      resetForm()
    } catch {
      alert('Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteClient(deletingId)
      await loadClients()
      setDeletingId(null)
    } catch {
      alert('Failed to delete client')
    }
  }

  const addMed = () => setForm((f) => ({ ...f, medications: [...f.medications, { name: '', dose: '', frequency: '' }] }))
  const removeMed = (i: number) => setForm((f) => ({ ...f, medications: f.medications.filter((_, idx) => idx !== i) }))
  const updateMed = (i: number, field: keyof Medication, value: string) => {
    setForm((f) => {
      const meds = [...f.medications]
      meds[i] = { ...meds[i], [field]: value }
      return { ...f, medications: meds }
    })
  }

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

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
              <div className="text-sm font-bold">Client Management</div>
              <div className="text-[11px] text-white/40">{clients.length} clients registered</div>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Client
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 overflow-auto">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm animate-pulse">
                <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-48 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="text-sm font-semibold text-slate-600">No clients found</div>
            <div className="text-xs text-slate-400 mt-1">{search ? 'Try a different search term' : 'Add your first client to get started'}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((client) => (
              <div key={client.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.darkNavy})` }}>
                      {client.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800">{client.name}</div>
                      <div className="text-xs text-slate-400">{client.age ? `${client.age} yrs` : '—'} · {client.address || 'No address'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(client)} className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer touch-target">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button onClick={() => setDeletingId(client.id)} className="w-11 h-11 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all bg-transparent border-none cursor-pointer touch-target">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
                {Array.isArray(client.conditions) && client.conditions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {client.conditions.map((cond) => (
                      <span key={cond} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(167,139,250,0.1)', color: COLORS.lavender, border: '1px solid rgba(167,139,250,0.15)' }}>
                        {cond}
                      </span>
                    ))}
                  </div>
                )}
                {Array.isArray(client.medications) && client.medications.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Medications</div>
                    <div className="flex flex-wrap gap-1.5">
                      {client.medications.map((med) => (
                        <span key={med.name} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>
                          {med.name} {med.dose}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {client.emergency_contact && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {client.emergency_contact}
                  </div>
                )}
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
              <h3 className="font-bold text-base text-slate-800">{editingId ? 'Edit Client' : 'Add Client'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all bg-transparent border-none cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Full Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all" placeholder="e.g. Mary Johnson" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Age</label>
                  <input type="number" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all" placeholder="e.g. 82" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Emergency Contact</label>
                  <input value={form.emergencyContact} onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all" placeholder="Name — 07700..." />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Address</label>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all" placeholder="e.g. 12 Oak Street, Manchester" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Conditions (comma separated)</label>
                <input value={form.conditions} onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all" placeholder="e.g. Dementia, Diabetes, Hypertension" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Preferences</label>
                <textarea value={form.preferences} onChange={(e) => setForm((f) => ({ ...f, preferences: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-50 border border-slate-200 outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 transition-all resize-none" placeholder="Care preferences, risks, notes..." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500">Medications</label>
                  <button onClick={addMed} className="text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg bg-transparent border-none cursor-pointer" style={{ color: COLORS.teal }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {form.medications.map((med, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={med.name} onChange={(e) => updateMed(i, 'name', e.target.value)} className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" placeholder="Name" />
                      <input value={med.dose} onChange={(e) => updateMed(i, 'dose', e.target.value)} className="w-20 px-3 py-2 rounded-lg text-xs bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" placeholder="Dose" />
                      <input value={med.frequency} onChange={(e) => updateMed(i, 'frequency', e.target.value)} className="w-24 px-3 py-2 rounded-lg text-xs bg-slate-50 border border-slate-200 outline-none focus:border-teal transition-all" placeholder="Freq" />
                      {form.medications.length > 1 && (
                        <button onClick={() => removeMed(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all bg-transparent border-none cursor-pointer shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 mt-2"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                {saving ? 'Saving...' : editingId ? 'Update Client' : 'Create Client'}
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
            <h3 className="font-bold text-base text-slate-800 text-center mb-1">Delete Client?</h3>
            <p className="text-xs text-slate-500 text-center mb-4">This will permanently remove the client and all associated records. This action cannot be undone.</p>
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
