import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  red: '#FF5A5F',
  amber: '#F6B73C',
  lavender: '#A78BFA',
}

interface VisitSummary {
  id: string
  submitted_at: string
  clientName: string
  elapsed: number
  mood?: string
  nutritionNote?: string
  notes?: string
  approval_status?: string
}

export default function FamilySummaryScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/family-summary/:id')
  const clientId = params?.id || ''
  const [visits, setVisits] = useState<VisitSummary[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('carei_visits')
    if (saved) {
      try {
        const all = JSON.parse(saved)
        const filtered = (Array.isArray(all) ? all : []).filter((v: any) =>
          v.clientId === clientId && (v.approval_status === 'released' || v.approval_status === 'approved')
        )
        setVisits(filtered)
      } catch { /* ignore */ }
    }
  }, [clientId])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button onClick={() => setLocation('/dashboard')} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Dashboard
        </button>
        <h1 className="font-serif text-lg font-bold">Family Summary</h1>
        <p className="text-white/50 text-sm">Approved visit reports</p>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto flex flex-col gap-3">
        {visits.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-8">No approved visits available for this client.</div>
        )}
        {visits.map((v) => {
          const date = v.submitted_at ? new Date(v.submitted_at) : new Date()
          return (
            <div key={v.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-800">{date.toLocaleDateString('en-GB')}</span>
                {v.approval_status === 'released' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Released</span>
                )}
              </div>
              <div className="text-xs text-slate-500 mb-2">Duration: {Math.floor(v.elapsed / 60)} minutes</div>
              {v.mood && (
                <div className="text-xs text-slate-600 mb-1">Mood: <span className="font-semibold">{v.mood}</span></div>
              )}
              {v.nutritionNote && (
                <div className="text-xs text-slate-600 mb-1">Nutrition: {v.nutritionNote}</div>
              )}
              {v.notes && (
                <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 mt-2">{v.notes}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
