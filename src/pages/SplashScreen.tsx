import { useLocation } from 'wouter'
import { useEffect, useRef, useState } from 'react'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  lavender: '#A78BFA',
}

function LoadingOverlay({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const duration = 3000
    const interval = 30
    const step = 100 / (duration / interval)
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step
        if (next >= 100) {
          clearInterval(timer)
          setTimeout(onDone, 200)
          return 100
        }
        return next
      })
    }, interval)
    return () => clearInterval(timer)
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: COLORS.darkNavy }}
    >
      {/* Logo */}
      <div className="mb-8 animate-bounce">
        <svg width="72" height="72" viewBox="0 0 32 32" fill="none">
          <path d="M16 28C16 28 6 21 6 13C6 9.5 8.5 7 11.5 7C13.6 7 15.3 8.1 16 9.8C16.7 8.1 18.4 7 20.5 7C23.5 7 26 9.5 26 13C26 21 16 28 16 28Z" fill="url(#tealGradLoad)" />
          <rect x="14" y="4" width="4" height="10" rx="1" fill="#fff" />
          <rect x="10" y="8" width="12" height="4" rx="1" fill="#fff" />
          <defs>
            <linearGradient id="tealGradLoad" x1="6" y1="7" x2="26" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor={COLORS.teal} />
              <stop offset="1" stopColor={COLORS.teal2} />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h1 className="font-serif text-2xl text-white font-bold tracking-wide mb-1">CAREi</h1>
      <p className="text-white/40 text-xs mb-8">Loading your care environment…</p>

      {/* Progress bar */}
      <div className="w-56 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-75 ease-linear"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`,
            boxShadow: `0 0 12px ${COLORS.teal}60`,
          }}
        />
      </div>
      <p className="text-white/30 text-[10px] mt-3 font-mono">{Math.round(progress)}%</p>
    </div>
  )
}

export default function SplashScreen() {
  const [, setLocation] = useLocation()
  const heroRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const els = document.querySelectorAll('[data-animate]')
    els.forEach((el, i) => {
      const htmlEl = el as HTMLElement
      htmlEl.style.opacity = '0'
      htmlEl.style.transform = 'translateY(24px)'
      htmlEl.style.transition = `opacity 0.7s ease ${i * 0.08}s, transform 0.7s ease ${i * 0.08}s`
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          htmlEl.style.opacity = '1'
          htmlEl.style.transform = 'translateY(0)'
        })
      })
    })
  }, [])

  const features = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      title: 'Smart Handover',
      desc: 'Seamless shift-to-shift care continuity with structured digital notes.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m19 11-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3l8.5 8.5 8-8Z" /><path d="m5 11 3 3" /><path d="m2 14 3 3" /><path d="m11 5 3 3" />
        </svg>
      ),
      title: 'Digital MAR',
      desc: 'Medication administration records with photo confirmation & double-check safety.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      ),
      title: 'Voice Docs',
      desc: 'Speak your observations. AI transcribes, structures & summarises care notes instantly.',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      ),
      title: 'Lone Worker SOS',
      desc: 'One-tap emergency alerts with live GPS broadcast to supervisors in real time.',
    },
  ]

  const stats = [
    { value: '200+', label: 'Care Homes' },
    { value: '15K+', label: 'Shifts Logged' },
    { value: '99.9%', label: 'Uptime' },
    { value: '4.9', label: 'App Store' },
  ]

  if (loading) {
    return <LoadingOverlay onDone={() => setLoading(false)} />
  }

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden" style={{ background: COLORS.darkNavy }}>
      {/* Inline keyframe animations */}
      <style>{`
        @keyframes float {
          0%,100%{transform:translateY(0) rotate(0deg)}
          50%{transform:translateY(-20px) rotate(2deg)}
        }
        @keyframes pulse-glow {
          0%,100%{opacity:0.4;transform:scale(1)}
          50%{opacity:0.7;transform:scale(1.08)}
        }
        .orb-1{animation:float 8s ease-in-out infinite}
        .orb-2{animation:float 10s ease-in-out infinite 2s}
        .orb-3{animation:float 12s ease-in-out infinite 4s}
        .glow-pulse{animation:pulse-glow 4s ease-in-out infinite}
      `}</style>

      {/* Animated Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="orb-1 absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ background: `radial-gradient(circle, ${COLORS.teal}25 0%, transparent 70%)` }}
        />
        <div
          className="orb-2 absolute top-1/3 -right-40 w-[450px] h-[450px] rounded-full blur-[100px]"
          style={{ background: `radial-gradient(circle, ${COLORS.lavender}18 0%, transparent 70%)` }}
        />
        <div
          className="orb-3 absolute -bottom-20 left-1/3 w-[400px] h-[400px] rounded-full blur-[110px]"
          style={{ background: `radial-gradient(circle, ${COLORS.teal2}15 0%, transparent 70%)` }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full" data-animate>
        <div className="flex items-center gap-2.5">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 28C16 28 6 21 6 13C6 9.5 8.5 7 11.5 7C13.6 7 15.3 8.1 16 9.8C16.7 8.1 18.4 7 20.5 7C23.5 7 26 9.5 26 13C26 21 16 28 16 28Z" fill="url(#tealGrad2)" />
            <rect x="14" y="4" width="4" height="10" rx="1" fill="#fff" />
            <rect x="10" y="8" width="12" height="4" rx="1" fill="#fff" />
            <defs>
              <linearGradient id="tealGrad2" x1="6" y1="7" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor={COLORS.teal} />
                <stop offset="1" stopColor={COLORS.teal2} />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-serif text-xl text-white tracking-wide font-semibold">CAREi</span>
        </div>
        <button
          onClick={() => setLocation('/manager/login')}
          className="text-white/50 hover:text-white text-sm font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer"
        >
          Manager Portal
        </button>
      </nav>

      {/* Hero */}
      <div ref={heroRef} className="relative z-10 flex-1 flex flex-col items-center px-6 pt-6 pb-12">
        {/* Stats ribbon */}
        <div className="w-full max-w-6xl mb-8" data-animate>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-white font-bold text-lg" style={{ textShadow: `0 0 20px ${COLORS.teal}40` }}>{s.value}</div>
                <div className="text-white/40 text-[10px] uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column hero content */}
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text + CTAs + Badges */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Headline */}
            <div className="w-full mb-8" data-animate>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-5 text-[11px] font-semibold tracking-wide uppercase"
                style={{ background: 'rgba(79,209,197,0.1)', color: COLORS.teal, border: `1px solid ${COLORS.teal}25` }}
              >
                <span className="w-1.5 h-1.5 rounded-full glow-pulse inline-block" style={{ background: COLORS.teal }} />
                Now with AI Copilot & Real-Time Manager Dashboard
              </div>
              <h1
                className="font-serif text-white leading-[1.1] mb-4 font-bold"
                style={{ fontSize: 'clamp(36px, 7vw, 56px)' }}
              >
                Care That<br />
                <span style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Documents Itself
                </span>
              </h1>
              <p className="text-white/50 leading-relaxed max-w-md mx-auto lg:mx-0" style={{ fontSize: 'clamp(14px, 2.2vw, 17px)' }}>
                AI-powered care management for frontline carers.
                Voice notes, digital MAR, instant handovers — all in one place.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="w-full max-w-sm flex flex-col gap-3 mb-10" data-animate>
              <button
                onClick={() => setLocation('/login')}
                className="w-full py-4 px-6 rounded-2xl border-none font-bold text-base cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`,
                  color: COLORS.darkNavy,
                  boxShadow: `0 8px 32px ${COLORS.teal}40, inset 0 1px 0 rgba(255,255,255,0.3)`,
                }}
              >
                Get Started Free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setLocation('/login')}
                className="w-full py-3.5 px-6 rounded-2xl border text-white font-semibold text-sm cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 hover:bg-white/5"
                style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" x2="3" y1="12" y2="12" />
                </svg>
                Staff Login
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex gap-3 flex-wrap justify-center lg:justify-start max-w-xl" data-animate>
              {[
                { icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, title: 'GDPR Ready', sub: 'UK Data Protection' },
                { icon: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, title: 'NHS-Aligned', sub: 'DSPT Compliant' },
                { icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>, title: 'End-to-End', sub: 'Encrypted' },
              ].map((b) => (
                <div
                  key={b.title}
                  className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all duration-200 hover:bg-white/8"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.teal}20, ${COLORS.teal2}10)` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {b.icon}
                    </svg>
                  </div>
                  <div>
                    <div className="text-white text-xs font-semibold">{b.title}</div>
                    <div className="text-white/40 text-[10px]">{b.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="w-full relative" data-animate>
            <div
              className="rounded-3xl overflow-hidden relative"
              style={{
                border: '1px solid rgba(79,209,197,0.15)',
                boxShadow: `0 24px 80px -20px ${COLORS.darkNavy}, 0 0 60px ${COLORS.teal}10`,
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=1200&auto=format&fit=crop&q=80"
                alt="Caregiver providing compassionate care"
                className="w-full h-auto block"
                style={{ filter: 'brightness(0.95) contrast(1.05)' }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-24" style={{ background: 'linear-gradient(to top, rgba(11,17,32,0.8), transparent)' }} />
            </div>
            <div
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-2"
              style={{
                background: 'rgba(11,17,32,0.9)',
                border: `1px solid ${COLORS.teal}30`,
                backdropFilter: 'blur(10px)',
              }}
            >
              <span className="w-2 h-2 rounded-full glow-pulse inline-block" style={{ background: '#22c55e' }} />
              <span className="text-white text-xs font-medium">Live across 200+ care homes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 px-6 py-20" style={{ background: '#f8fafc' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: COLORS.teal }}>Features</div>
            <h2 className="font-serif font-bold mb-3" style={{ color: COLORS.darkNavy, fontSize: 'clamp(22px, 4vw, 32px)' }}>
              Everything carers need, nothing they don't
            </h2>
            <p className="text-slate-500 max-w-md mx-auto text-sm">
              Built with frontline carers and managers. Designed for speed, safety, and compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group bg-white rounded-2xl p-6 border border-slate-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default"
                data-animate
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                  style={{ background: `linear-gradient(135deg, ${COLORS.teal}15, ${COLORS.teal2}10)`, color: COLORS.teal }}
                >
                  {f.icon}
                </div>
                <div className="font-bold text-[15px] mb-1.5" style={{ color: COLORS.darkNavy }}>{f.title}</div>
                <div className="text-slate-500 text-sm leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="relative z-10 px-6 py-20" style={{ background: COLORS.darkNavy }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: COLORS.teal }}>How It Works</div>
            <h2 className="font-serif font-bold mb-3 text-white" style={{ fontSize: 'clamp(22px, 4vw, 32px)' }}>
              Set up in minutes, not months
            </h2>
            <p className="text-white/50 max-w-md mx-auto text-sm">
              No IT team required. Create your organization, invite carers, and start logging care the same day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Create Your Organization', desc: 'Sign up, choose your plan, and configure your care home or agency in under 5 minutes.' },
              { step: '02', title: 'Invite Your Team', desc: 'Send invites to carers and managers. They join instantly with a secure link — no passwords to remember.' },
              { step: '03', title: 'Start Logging Care', desc: 'Carers clock in, record voice notes, complete MAR checks, and hand over shifts digitally.' },
            ].map((item) => (
              <div key={item.step} className="relative" data-animate>
                <div className="text-5xl font-bold font-serif mb-4" style={{ color: `${COLORS.teal}20` }}>{item.step}</div>
                <h3 className="text-white font-semibold text-base mb-2">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Preview */}
      <div className="relative z-10 px-6 py-20" style={{ background: '#f8fafc' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14" data-animate>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: COLORS.teal }}>Pricing</div>
            <h2 className="font-serif font-bold mb-3" style={{ color: COLORS.darkNavy, fontSize: 'clamp(22px, 4vw, 32px)' }}>
              Simple, transparent pricing
            </h2>
            <p className="text-slate-500 max-w-md mx-auto text-sm">
              Start free. Upgrade when you grow. No hidden fees, no long-term contracts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { name: 'Trial', price: 'Free', period: '14 days', users: '3 users', clients: '10 clients', highlight: false },
              { name: 'Professional', price: '£49', period: '/month', users: '15 users', clients: '100 clients', highlight: true },
              { name: 'Enterprise', price: 'Custom', period: '', users: 'Unlimited', clients: 'Unlimited', highlight: false },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border transition-all duration-300 hover:shadow-xl ${plan.highlight ? 'border-teal-400/40 shadow-lg scale-[1.02]' : 'border-slate-200 bg-white'}`}
                style={plan.highlight ? { background: COLORS.darkNavy, borderColor: `${COLORS.teal}40` } : {}}
                data-animate
              >
                <div className={`text-xs font-bold uppercase tracking-widest mb-4 ${plan.highlight ? 'text-teal-400' : 'text-slate-400'}`}>{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className={`text-3xl font-bold ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? 'text-white/50' : 'text-slate-500'}`}>{plan.period}</span>
                </div>
                <div className="space-y-2 mb-6">
                  <div className={`flex items-center gap-2 text-sm ${plan.highlight ? 'text-white/70' : 'text-slate-600'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={plan.highlight ? COLORS.teal : COLORS.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    {plan.users}
                  </div>
                  <div className={`flex items-center gap-2 text-sm ${plan.highlight ? 'text-white/70' : 'text-slate-600'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={plan.highlight ? COLORS.teal : COLORS.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    {plan.clients}
                  </div>
                  <div className={`flex items-center gap-2 text-sm ${plan.highlight ? 'text-white/70' : 'text-slate-600'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={plan.highlight ? COLORS.teal : COLORS.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    All features included
                  </div>
                </div>
                <button
                  onClick={() => setLocation('/login')}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${plan.highlight ? 'bg-teal-400 text-slate-900 hover:bg-teal-300' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="relative z-10 px-6 py-16" style={{ background: COLORS.darkNavy }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12" data-animate>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: COLORS.teal }}>Testimonials</div>
            <h2 className="font-serif font-bold text-white" style={{ fontSize: 'clamp(22px, 4vw, 32px)' }}>
              Loved by care teams
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { quote: 'CAREi cut our documentation time in half. Carers actually fill in notes now because they can just speak them.', author: 'Sarah Johnson', role: 'Operations Director, Harmony Home Care', initials: 'SJ' },
              { quote: 'The SOS alert feature alone is worth it. Our lone workers feel safer, and managers get instant visibility.', author: 'David Chen', role: 'Registered Manager, SafeHands Care', initials: 'DC' },
            ].map((t) => (
              <div key={t.author} className="rounded-2xl p-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }} data-animate>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={`${COLORS.teal}60`} strokeWidth="1.5" className="mb-4">
                  <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21c0 1 0 1 1 1z" />
                  <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
                </svg>
                <blockquote className="text-white/80 text-sm leading-relaxed mb-5">"{t.quote}"</blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}>{t.initials}</div>
                  <div>
                    <div className="text-white text-sm font-semibold">{t.author}</div>
                    <div className="text-white/40 text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative z-10 px-6 py-16" style={{ background: `linear-gradient(180deg, ${COLORS.darkNavy}, #0f1a30)` }}>
        <div className="max-w-2xl mx-auto text-center" data-animate>
          <h2 className="font-serif font-bold text-white text-2xl sm:text-3xl mb-4">
            Ready to modernise your care operation?
          </h2>
          <p className="text-white/50 text-sm mb-8 max-w-md mx-auto">
            Join 200+ care homes already using CAREi to save time, improve compliance, and keep carers safe.
          </p>
          <button
            onClick={() => setLocation('/login')}
            className="px-8 py-4 rounded-2xl border-none font-bold text-base cursor-pointer inline-flex items-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`,
              color: COLORS.darkNavy,
              boxShadow: `0 8px 32px ${COLORS.teal}40`,
            }}
          >
            Start Your Free Trial
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
          <p className="text-white/30 text-xs mt-4">No credit card required. 14-day free trial.</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-6 border-t" style={{ background: COLORS.darkNavy, borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 28C16 28 6 21 6 13C6 9.5 8.5 7 11.5 7C13.6 7 15.3 8.1 16 9.8C16.7 8.1 18.4 7 20.5 7C23.5 7 26 9.5 26 13C26 21 16 28 16 28Z" fill="url(#tealGrad3)" />
              <defs>
                <linearGradient id="tealGrad3" x1="6" y1="7" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor={COLORS.teal} />
                  <stop offset="1" stopColor={COLORS.teal2} />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-white/60 text-sm">CAREi</span>
          </div>
          <div className="text-white/30 text-xs text-center">
            &copy; 2025 CAREi. Built for frontline carers across the UK.
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: COLORS.teal }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Trusted by care agencies across the UK
          </div>
        </div>
      </footer>
    </div>
  )
}
