import { useLocation } from 'wouter'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
}

export default function SplashScreen() {
  const [, setLocation] = useLocation()

  const features = [
    { icon: '🔄', title: 'Smart Handover', desc: 'Seamless shift-to-shift care continuity' },
    { icon: '💊', title: 'Medication Confirmation', desc: 'Digital MAR with double-check safety' },
    { icon: '🎤', title: 'Voice Documentation', desc: 'Speak your notes, we write them up' },
    { icon: '🚨', title: 'Lone Worker Safety', desc: 'SOS & check-in for remote carers' },
  ]

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
    >
      {/* Wave Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.4 }}>
          <path d="M0,180 Q400,80 800,220 T1440,160" fill="none" stroke={COLORS.teal} strokeWidth="1.2" strokeDasharray="3 5" opacity="0.35" />
          <path d="M0,320 Q500,220 900,360 T1440,280" fill="none" stroke={COLORS.teal} strokeWidth="1" strokeDasharray="2 6" opacity="0.25" />
          <path d="M0,460 Q300,360 700,500 T1440,420" fill="none" stroke={COLORS.teal} strokeWidth="0.8" strokeDasharray="3 7" opacity="0.2" />
          <path d="M0,600 Q600,500 1000,640 T1440,560" fill="none" stroke={COLORS.teal} strokeWidth="1" strokeDasharray="4 8" opacity="0.3" />
          <path d="M0,740 Q400,640 800,780 T1440,700" fill="none" stroke={COLORS.teal} strokeWidth="0.8" strokeDasharray="2 8" opacity="0.2" />
        </svg>
      </div>

      {/* Top Nav */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full shrink-0">
        <div className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 28C16 28 6 21 6 13C6 9.5 8.5 7 11.5 7C13.6 7 15.3 8.1 16 9.8C16.7 8.1 18.4 7 20.5 7C23.5 7 26 9.5 26 13C26 21 16 28 16 28Z" fill="url(#tealGrad)" />
            <rect x="14" y="4" width="4" height="10" rx="1" fill="#fff" />
            <rect x="10" y="8" width="12" height="4" rx="1" fill="#fff" />
            <defs>
              <linearGradient id="tealGrad" x1="6" y1="7" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor={COLORS.teal} />
                <stop offset="1" stopColor={COLORS.teal2} />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-serif text-xl text-white tracking-wide">CAREi</span>
        </div>
        <button className="flex flex-col gap-1 p-1 bg-transparent border-none cursor-pointer">
          <span className="block w-5 h-0.5 bg-white rounded-sm" />
          <span className="block w-5 h-0.5 bg-white rounded-sm" />
          <span className="block w-3.5 h-0.5 bg-white rounded-sm" />
        </button>
      </div>

      {/* Hero Section */}
      <div className="relative z-10 flex-1 flex flex-col items-center px-6 pb-7 gap-5">
        {/* Headline */}
        <div className="w-full max-w-xl text-left">
          <h1 className="font-serif text-white leading-tight mb-3" style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>
            Care That<br />Documents <span style={{ color: COLORS.teal }}>Itself</span>
          </h1>
          <p className="text-white/60 leading-relaxed" style={{ fontSize: 'clamp(13px, 2vw, 16px)' }}>
            AI-powered care management<br />for frontline carers.
          </p>
        </div>

        {/* Hero Image */}
        <div className="w-full max-w-lg rounded-3xl overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&auto=format&fit=crop&q=80"
            alt="Caregiver with elderly person"
            className="w-full h-auto block"
          />
        </div>

        {/* Buttons */}
        <div className="w-full max-w-lg flex flex-col gap-2.5">
          <button
            onClick={() => setLocation('/login')}
            className="w-full py-3.5 px-6 rounded-full border-none font-bold text-base cursor-pointer flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`,
              color: COLORS.darkNavy,
              boxShadow: '0 8px 32px rgba(79,209,197,0.3)',
            }}
          >
            Start Shift <span className="text-lg">→</span>
          </button>
          <button
            className="w-full py-3 px-6 rounded-full border text-white font-semibold text-sm cursor-pointer flex items-center justify-center gap-2"
            style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}
          >
            <span className="inline-flex w-5 h-5 rounded-full border-2 border-white items-center justify-center text-[10px]">▶</span>
            Watch Demo
          </button>
          <button
            onClick={() => setLocation('/manager/login')}
            className="w-full py-2.5 px-6 rounded-full border-none text-white/60 text-xs cursor-pointer hover:text-white transition-colors"
            style={{ background: 'transparent' }}
          >
            Manager Portal →
          </button>
        </div>

        {/* Trust Badges */}
        <div className="flex gap-2.5 flex-wrap justify-center max-w-xl">
          {/* GDPR */}
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, rgba(79,209,197,0.2), rgba(64,224,208,0.1))` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div>
              <div className="text-white text-xs font-bold">GDPR</div>
              <div className="text-white/50 text-[11px]">Compliant</div>
            </div>
          </div>
          {/* Secure */}
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, rgba(79,209,197,0.2), rgba(64,224,208,0.1))` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <div className="text-white text-xs font-bold">Secure</div>
              <div className="text-white/50 text-[11px]">Care Records</div>
            </div>
          </div>
          {/* AI-Assisted */}
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, rgba(79,209,197,0.2), rgba(64,224,208,0.1))` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
                <path d="M5 3v4" /><path d="M9 5H5" />
                <path d="M19 15v4" /><path d="M15 17h4" />
              </svg>
            </div>
            <div>
              <div className="text-white text-xs font-bold">AI-Assisted</div>
              <div className="text-white/50 text-[11px]">Care</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 bg-slate-50 px-6 py-10 shrink-0">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center font-bold mb-7" style={{ color: COLORS.darkNavy, fontSize: 'clamp(16px, 3vw, 22px)' }}>
            Powerful features for modern care
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3.5">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-5 border border-slate-200 text-center">
                <div
                  className="w-[52px] h-[52px] rounded-full flex items-center justify-center mx-auto mb-3 text-[22px]"
                  style={{ background: `linear-gradient(135deg, rgba(79,209,197,0.12), rgba(64,224,208,0.08))` }}
                >
                  {f.icon}
                </div>
                <div className="font-bold text-[13px] mb-1" style={{ color: COLORS.darkNavy }}>{f.title}</div>
                <div className="text-slate-500 text-xs leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trusted Footer */}
      <div className="relative z-10 bg-white px-6 py-4 text-center shrink-0 border-t border-slate-200">
        <div className="flex items-center justify-center gap-1.5 text-sm font-medium" style={{ color: COLORS.teal }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Trusted by care agencies across the UK
        </div>
      </div>
    </div>
  )
}
