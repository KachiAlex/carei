import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { getVisits } from '../api/client'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  red: '#FF5A5F',
  amber: '#F6B73C',
}

interface VisitRecord {
  id: string
  client_name: string
  visit_time: string
  submitted_at: string
  status: string
  approval_status?: string
  elapsed?: number
}

export default function VisitHistoryScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/client/:id/history')
  const clientId = params?.id || ''
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    getVisits()
      .then((data: any[]) => {
        const filtered = data.filter((v) => v.client_id === clientId || v.clientId === clientId)
        setVisits(filtered.sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button onClick={() => setLocation(`/client/${clientId}/overview`)} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <h1 className="font-serif text-lg font-bold">Visit History</h1>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-auto">
        {visits.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-8">No completed visits for this client yet.</div>
        )}
        {visits.map((v) => {
          const date = v.submitted_at ? new Date(v.submitted_at) : new Date()
          const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={v.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-800">{dateStr}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.approval_status === 'released' ? 'bg-green-100 text-green-700' : v.approval_status === 'approved' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                  {v.approval_status === 'released' ? 'Released' : v.approval_status === 'approved' ? 'Approved' : 'Pending Review'}
                </span>
              </div>
              <div className="text-xs text-slate-500">{timeStr} · {v.client_name}</div>
              {v.elapsed && <div className="text-[10px] text-slate-400 mt-1">Duration: {Math.floor(v.elapsed / 60)} min</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
