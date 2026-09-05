import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { useTenant } from '../contexts/TenantContext'
import { getVisitApprovals, updateVisitApproval } from '../api/client'
import { exportVisits } from '../utils/exportCsv'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
}

interface VisitApproval {
  id: string
  client_name: string
  carer_name: string
  submitted_at: string
  approval_status: string
  elapsed?: number
}

export default function ManagerApprovalsScreen() {
  const [, setLocation] = useLocation()
  const { currentTenant } = useTenant()
  const [visits, setVisits] = useState<VisitApproval[]>([])
  const [filter, setFilter] = useState<'pending' | 'approved' | 'released'>('pending')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Track checklist per visit ID
  const [checklists, setChecklists] = useState<Record<string, {
    notes: boolean,
    concerns: boolean,
    meds: boolean,
    safeguarding: boolean
  }>>({})

  useEffect(() => {
    loadApprovals()
  }, [filter])

  const toggleCheck = (visitId: string, point: keyof typeof checklists[string]) => {
    setChecklists(prev => ({
      ...prev,
      [visitId]: {
        ...(prev[visitId] || { notes: false, concerns: false, meds: false, safeguarding: false }),
        [point]: !prev[visitId]?.[point]
      }
    }))
  }

  const isChecklistComplete = (visitId: string) => {
    const c = checklists[visitId]
    return c && c.notes && c.concerns && c.meds && c.safeguarding
  }

  const loadApprovals = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getVisitApprovals(filter === 'pending' ? 'pending' : filter)
      setVisits(Array.isArray(data) ? data : (data.visits || []))
    } catch (err: any) {
      setError(err.message || 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (visitId: string, newStatus: string) => {
    if (newStatus === 'released' && !isChecklistComplete(visitId)) {
      alert('Please complete the safety checklist before releasing to family.')
      return
    }
    try {
      await updateVisitApproval({ visitId, approvalStatus: newStatus })
      setVisits((prev) => prev.map((v) => v.id === visitId ? { ...v, approval_status: newStatus } : v))
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    }
  }

  const filtered = visits.filter((v) => (filter === 'pending' ? v.approval_status !== 'approved' && v.approval_status !== 'released' : v.approval_status === filter))

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button onClick={() => currentTenant && setLocation(`/tenant/${currentTenant.slug}/manager`)} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Dashboard
        </button>
        <h1 className="font-serif text-lg font-bold">ContinuCare+ Approvals</h1>
      </div>

      {/* Filters + Export */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <div className="flex gap-0 flex-1">
        {[
          { key: 'pending' as const, label: 'Pending Review' },
          { key: 'approved' as const, label: 'Approved (Audit Only)' },
          { key: 'released' as const, label: 'Released to Family' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="flex-1 py-3 text-[10px] font-bold border-none bg-transparent cursor-pointer transition-all uppercase tracking-tight"
            style={{
              color: filter === f.key ? COLORS.teal : '#94a3b8',
              borderBottom: `2px solid ${filter === f.key ? COLORS.teal : 'transparent'}`,
            }}
          >
            {f.label}
          </button>
        ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl text-xs font-semibold" style={{ background: 'rgba(255,90,95,0.1)', color: COLORS.red }}>
          {error}
        </div>
      )}
      <div className="flex-1 px-4 py-4 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-8">No visits in this category.</div>
        )}
        {filtered.map((v) => {
          const date = v.submitted_at ? new Date(v.submitted_at) : new Date()
          const check = checklists[v.id] || { notes: false, concerns: false, meds: false, safeguarding: false }
          
          return (
            <div key={v.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-800">{v.client_name || 'Unknown'}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.approval_status === 'released' ? 'bg-green-100 text-green-700' : v.approval_status === 'approved' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                  {v.approval_status === 'released' ? 'Released ✓' : v.approval_status === 'approved' ? 'Approved' : 'Awaiting Review'}
                </span>
              </div>
              <div className="text-xs text-slate-500 mb-2">{v.carer_name || 'Unknown carer'} · {date.toLocaleDateString('en-GB')} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              
              {filter === 'pending' && (
                <>
                  <div className="my-3 py-3 border-y border-slate-50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pre-Release Clinical Checklist</div>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'notes', label: "Notes appropriate for family reading" },
                        { id: 'concerns', label: "No clinical concerns requiring call first" },
                        { id: 'meds', label: "Medication log complete and accurate" },
                        { id: 'safeguarding', label: "No safeguarding issues flagged" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => toggleCheck(v.id, item.id as any)}
                          className="flex items-center gap-2 text-left bg-transparent border-none cursor-pointer group"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${check[item.id as keyof typeof check] ? 'bg-teal border-teal' : 'border-slate-300 group-hover:border-teal'}`}>
                            {check[item.id as keyof typeof check] && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <span className={`text-[11px] ${check[item.id as keyof typeof check] ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(v.id, 'approved')}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-100 cursor-pointer"
                    >
                      Audit Approve
                    </button>
                    <button
                      onClick={() => updateStatus(v.id, 'released')}
                      disabled={!isChecklistComplete(v.id)}
                      className={`flex-[2] py-2.5 rounded-xl text-xs font-bold text-white border-none cursor-pointer transition-all ${isChecklistComplete(v.id) ? 'bg-green-500 shadow-md shadow-green-500/20' : 'bg-slate-300 cursor-not-allowed opacity-60'}`}
                    >
                      Release to Family
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
