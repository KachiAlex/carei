import { useLocation } from 'wouter'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  red: '#FF5A5F',
  amber: '#F6B73C',
}

interface EmergencyContact {
  name: string
  number: string
  subtitle?: string
  urgent?: boolean
}

export default function EmergencyScreen() {
  const [, setLocation] = useLocation()

  const contacts: EmergencyContact[] = [
    { name: '999 Emergency', number: '999', subtitle: 'Ambulance, Fire, Police', urgent: true },
    { name: 'NHS 111', number: '111', subtitle: 'Non-emergency medical advice', urgent: true },
    { name: 'GP Surgery', number: '02079460123', subtitle: 'Dr. Patel — Elm Grove Surgery' },
    { name: 'Agency Office', number: '08001234567', subtitle: '24hr on-call coordinator' },
    { name: 'Poison Control', number: '03448920111', subtitle: 'National Poisons Information Service' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button onClick={() => setLocation('/dashboard')} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Dashboard
        </button>
        <h1 className="font-serif text-lg font-bold">Emergency Contacts</h1>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-auto">
        {contacts.map((c) => (
          <a
            key={c.name}
            href={`tel:${c.number.replace(/\s/g, '')}`}
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3 no-underline"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: c.urgent ? 'rgba(255,90,95,0.08)' : 'rgba(79,209,197,0.08)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.urgent ? COLORS.red : COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-800">{c.name}</div>
              {c.subtitle && <div className="text-[10px] text-slate-500">{c.subtitle}</div>}
            </div>
            <span className="text-sm font-bold shrink-0" style={{ color: c.urgent ? COLORS.red : COLORS.teal }}>{c.number}</span>
          </a>
        ))}

        {/* DNAR Notice */}
        <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm mt-2">
          <div className="flex items-center gap-2 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
            </svg>
            <span className="text-sm font-bold text-red-600">DNAR Notice</span>
          </div>
          <p className="text-xs text-slate-600">If applicable, check the client's file for a Do Not Attempt Resuscitation order. Always follow agency protocol.</p>
        </div>
      </div>
    </div>
  )
}
