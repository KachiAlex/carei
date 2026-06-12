import { useLocation } from 'wouter'
import { exportVisits } from '../utils/exportCsv'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
  lavender: '#A78BFA',
}

export default function AdminTeaserScreen() {
  const [, setLocation] = useLocation()

  const complianceScore = 96
  const circumference = 2 * Math.PI * 40
  const dash = (complianceScore / 100) * circumference

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button onClick={() => setLocation('/manager')} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Dashboard
        </button>
        <h1 className="font-serif text-lg font-bold">Admin</h1>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto flex flex-col gap-4">
        {/* Compliance Ring */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
          <h3 className="font-bold text-sm text-slate-800 mb-4">Compliance Score</h3>
          <div className="relative w-24 h-24 mx-auto">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="40" fill="none" stroke={COLORS.teal} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={0}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">{complianceScore}%</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-3">Based on last 30 days of visits</div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Staff', value: '12' },
            { label: 'Clients', value: '28' },
            { label: 'Visits', value: '156' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
              <div className="text-lg font-bold text-slate-800">{s.value}</div>
              <div className="text-[10px] text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-3">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <button onClick={() => setLocation('/manager')} className="text-left text-sm text-slate-600 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer bg-transparent border-none">
              Manager Dashboard
            </button>
            <button onClick={() => setLocation('/manager/clients')} className="text-left text-sm text-slate-600 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer bg-transparent border-none">
              Client Management
            </button>
            <button onClick={() => setLocation('/manager/schedule')} className="text-left text-sm text-slate-600 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer bg-transparent border-none">
              Visit Scheduling
            </button>
            <button onClick={() => setLocation('/manager/approvals')} className="text-left text-sm text-slate-600 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer bg-transparent border-none">
              Pending Approvals
            </button>
            <button onClick={() => { const saved = localStorage.getItem('carei_visits'); exportVisits(saved ? JSON.parse(saved) : []) }} className="text-left text-sm text-slate-600 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer bg-transparent border-none">
              Export Visit Data
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
