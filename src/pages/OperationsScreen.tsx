import { useLocation } from 'wouter'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  red: '#FF5A5F',
  amber: '#F6B73C',
}

export default function OperationsScreen() {
  const [, setLocation] = useLocation()

  const kpis = [
    { label: 'Visits Today', value: '12', sub: '8 completed' },
    { label: 'Compliance', value: '96%', sub: '+2% vs last week' },
    { label: 'Incidents', value: '1', sub: '0 unresolved' },
    { label: 'Staff On Duty', value: '6', sub: '2 on break' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button onClick={() => setLocation('/dashboard')} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Dashboard
        </button>
        <h1 className="font-serif text-lg font-bold">Operations</h1>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">{k.label}</div>
              <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
              <div className="text-[10px] text-teal mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-3">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Live Alerts</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-xl p-2.5 bg-red-50">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-red-700">Lone worker overdue</div>
                <div className="text-[10px] text-red-500">Sarah M. · 15 min past check-in</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl p-2.5 bg-amber-50">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-amber-700">Missed medication</div>
                <div className="text-[10px] text-amber-500">Client #2847 · 08:30 due</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl p-2.5 bg-green-50">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-green-700">Visit completed on time</div>
                <div className="text-[10px] text-green-500">John D. · Client #1203</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
