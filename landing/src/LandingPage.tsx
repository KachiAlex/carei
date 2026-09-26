import { useEffect, useRef, useState } from 'react'

const APP_URL = 'https://app.careiapp.com'
const API_BASE = 'https://api.careiapp.com/api'

interface Plan {
  slug: string
  name: string
  max_users: number
  max_clients: number
  price_per_carer: number | string
  billing_model: string
  is_default: boolean
}

// Mirrors the live rows in the `plans` table (verified via /api/public-plans).
// Used only when the endpoint is unreachable.
const FALLBACK_PLANS: Plan[] = [
  { slug: 'trial', name: 'Starter', max_users: 5, max_clients: 10, price_per_carer: 8, billing_model: 'per-carer', is_default: true },
  { slug: 'professional', name: 'Professional', max_users: 25, max_clients: 50, price_per_carer: 14, billing_model: 'per-carer', is_default: false },
  { slug: 'enterprise', name: 'Enterprise', max_users: 100, max_clients: 500, price_per_carer: 0, billing_model: 'custom', is_default: false },
]

const PLAN_FEATURES: Record<string, string[]> = {
  trial: [
    'Digital MAR and handover',
    'Lone worker SOS',
    'Vitals and fluid tracking',
    'Supervisor dashboard',
    'UK data hosting',
  ],
  professional: [
    'Everything in Starter',
    'AI Copilot and voice documentation',
    'AI care-plan creator',
    'Audio shift briefing',
    'Passive lone-worker monitoring',
    'Audit export and reporting',
  ],
  enterprise: [
    'Everything in Professional',
    'Dedicated account support',
    'Custom integrations',
    'Service-level options',
    'Implementation and training support',
  ],
}

const PLAN_DESCRIPTIONS: Record<string, string> = {
  trial: 'For small care teams moving from paper or fragmented tools to one digital workflow.',
  professional: 'For providers that want AI-assisted documentation and a fuller compliance workflow.',
  enterprise: 'For multi-site organisations that need broader controls, implementation support and integrations.',
}

const PLAN_CTA: Record<string, string> = {
  trial: 'Start free trial',
  professional: 'Start free trial',
  enterprise: 'Talk to sales',
}

function getPricingDisplay(plan: Plan): { price: string; unit: string } {
  if (plan.billing_model === 'custom') {
    return { price: 'Custom', unit: '' }
  }
  // price_per_carer is a NUMERIC column — the API serialises it as a string
  const price = typeof plan.price_per_carer === 'string'
    ? parseFloat(plan.price_per_carer)
    : Number(plan.price_per_carer)
  if (!Number.isFinite(price) || price <= 0) {
    return { price: 'Free', unit: '' }
  }
  const priceStr = `£${Number.isInteger(price) ? price : price.toFixed(2)}`
  const unitStr = plan.billing_model === 'per-carer' ? '/ carer / month' : `/ ${plan.billing_model}`
  return { price: priceStr, unit: unitStr }
}

type TabKey = 'visit' | 'meds' | 'handover' | 'oversight'

const FEATURE_COPY: Record<TabKey, { k: string; t: string; x: string; b: string[] }> = {
  visit: {
    k: 'Frontline workflow',
    t: 'Everything the carer needs, exactly when they need it.',
    x: 'CAREi keeps the active visit focused: client context, tasks, medication, observations, notes and safety tools are all available without jumping between disconnected screens.',
    b: ['Client briefing before care starts', 'Voice and structured documentation', 'Safety tools always within reach'],
  },
  meds: {
    k: 'Digital MAR',
    t: 'Medication records that are fast for carers and clear for managers.',
    x: 'Confirm each medication individually, capture exceptions and keep the administration record connected to the visit, user and time it happened.',
    b: ['Per-medication confirmation', 'Clear pending and exception states', 'Structured record for later review'],
  },
  handover: {
    k: 'Continuity of care',
    t: 'The next carer should not have to reconstruct the previous visit.',
    x: 'CAREi turns the important observations, completed actions and follow-ups from one visit into a concise handover for the next person.',
    b: ['Key observations summarised', 'Outstanding actions carried forward', 'Less reliance on memory and phone calls'],
  },
  oversight: {
    k: 'Operational visibility',
    t: 'Supervisors see what needs attention without hovering over every visit.',
    x: 'Active visits, medication issues, safety status and exceptions can be surfaced in one operational view so managers can focus on what actually needs intervention.',
    b: ['Live visit visibility', 'Priority exceptions and alerts', 'Shared operational picture'],
  },
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'visit', label: 'During a visit' },
  { key: 'meds', label: 'Medication' },
  { key: 'handover', label: 'Handover' },
  { key: 'oversight', label: 'Oversight' },
]

const COPILOT_PROMPT = 'What should I know before I complete Margaret’s visit?'

export default function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS)
  const [scrolled, setScrolled] = useState(false)
  const [tab, setTab] = useState<TabKey>('visit')
  const [typed, setTyped] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const demoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('show') }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/public-plans`)
      .then((res) => res.json())
      .then((data) => {
        if (data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(data.plans)
        }
      })
      .catch(() => {
        // Keep fallback plans on error
      })
  }, [])

  // Count-up animation for hero dashboard metrics
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-count]')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        const el = e.target as HTMLElement
        io.unobserve(el)
        const target = parseInt(el.dataset.count || '0', 10)
        const t0 = performance.now()
        const dur = 1300
        const tick = (t: number) => {
          const p = Math.min((t - t0) / dur, 1)
          el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
    }, { threshold: 0.4 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Copilot prompt typing effect, triggered when the demo card scrolls into view
  useEffect(() => {
    const el = demoRef.current
    if (!el) return
    let iv: ReturnType<typeof setInterval> | undefined
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        io.disconnect()
        let i = 0
        iv = setInterval(() => {
          i++
          setTyped(COPILOT_PROMPT.slice(0, i))
          if (i >= COPILOT_PROMPT.length) {
            clearInterval(iv)
            setTimeout(() => setShowAnswer(true), 400)
          }
        }, 30)
      })
    }, { threshold: 0.35 })
    io.observe(el)
    return () => { io.disconnect(); if (iv) clearInterval(iv) }
  }, [])

  // Cursor parallax tilt on the hero product stage
  const handleStageMove = (e: React.MouseEvent) => {
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - (r.left + r.width / 2)) / r.width
    const y = (e.clientY - (r.top + r.height / 2)) / r.height
    el.style.setProperty('--ry', `${x * 5}deg`)
    el.style.setProperty('--rx', `${-y * 4}deg`)
    el.style.setProperty('--tx', `${x * 16}px`)
    el.style.setProperty('--ty', `${y * 12}px`)
  }
  const resetStageTilt = () => {
    const el = stageRef.current
    if (!el) return
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--tx', '0px')
    el.style.setProperty('--ty', '0px')
  }

  const feature = FEATURE_COPY[tab]

  return (
    <div style={{ background: '#ffffff' }}>
      <style>{`
:root{
  --ink:#0b1f18;--ink2:#15372b;--muted:#60776f;--line:#dfe9e5;
  --green:#18d0ae;--green2:#0fb798;--deep:#073e34;--mint:#e9fbf7;--mint2:#f5fcfa;
  --white:#fff;--off:#f7fbfa;--danger:#e64949;--amber:#f2b84b;
  --shadow:0 24px 70px rgba(8,52,43,.12);--shadow2:0 12px 35px rgba(8,52,43,.09);
  --radius:28px;--radius-sm:18px;
  --f:'DM Sans',sans-serif;--fd:'Manrope',sans-serif;
}
*{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;font-family:var(--f);color:var(--ink);background:#fff;overflow-x:hidden;-webkit-font-smoothing:antialiased} a{text-decoration:none;color:inherit} button{font:inherit}
.container{width:min(1200px,calc(100% - 40px));margin:auto}.section{padding:112px 0}.eyebrow{display:inline-flex;align-items:center;gap:9px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--deep)}.eyebrow:before{content:'';width:26px;height:2px;background:var(--green);border-radius:9px}.h2{font-family:var(--fd);font-size:clamp(38px,5vw,64px);line-height:1.02;letter-spacing:-.045em;margin:16px 0 18px}.lead{font-size:17px;line-height:1.75;color:var(--muted);max-width:680px}.reveal{opacity:0;transform:translateY(20px);transition:.7s ease}.reveal.show{opacity:1;transform:none}
/* NAV */
.site-nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:16px 0;transition:.3s}.site-nav.scrolled{background:rgba(255,255,255,.88);backdrop-filter:blur(18px);border-bottom:1px solid rgba(223,233,229,.9);padding:10px 0}.nav{display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:11px;font-family:var(--fd);font-weight:800;font-size:20px}.brand-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,var(--green),#71efd8);display:grid;place-items:center;box-shadow:0 12px 30px rgba(24,208,174,.26)}.brand-mark svg{width:23px;height:23px}.nav-links{display:flex;gap:28px;align-items:center;font-size:14px;font-weight:600;color:#425c53}.nav-links a{position:relative}.nav-links a:after{content:'';position:absolute;height:2px;left:0;right:100%;bottom:-8px;background:var(--green);transition:.25s}.nav-links a:hover:after{right:0}.nav-actions{display:flex;align-items:center;gap:10px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:14px;padding:13px 19px;font-weight:800;cursor:pointer;transition:.25s}.btn:hover{transform:translateY(-2px)}.btn-ghost{background:#fff;border:1px solid var(--line);color:var(--ink)}.btn-primary{background:var(--ink);color:#fff;box-shadow:0 12px 28px rgba(11,31,24,.18)}.mobile-toggle{display:none;border:0;background:#fff;width:44px;height:44px;border-radius:12px;font-size:20px}
/* HERO */
.hero{position:relative;min-height:840px;padding:132px 0 86px;display:flex;align-items:center;background:radial-gradient(circle at 78% 16%,rgba(24,208,174,.16),transparent 23%),radial-gradient(circle at 10% 30%,rgba(113,239,216,.13),transparent 24%),linear-gradient(180deg,#fafffd 0%,#fff 78%);overflow:hidden}.hero:before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(11,31,24,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(11,31,24,.035) 1px,transparent 1px);background-size:44px 44px;mask-image:linear-gradient(to bottom,black,transparent 84%)}.hero-grid{position:relative;display:grid;grid-template-columns:.88fr 1.12fr;gap:58px;align-items:center}.hero-copy{position:relative;z-index:3}.hero-badge{display:inline-flex;align-items:center;gap:9px;background:#fff;border:1px solid #d7efe9;border-radius:999px;padding:8px 13px;font-size:12px;font-weight:800;color:var(--deep);box-shadow:0 8px 26px rgba(8,52,43,.06)}.pulse{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 6px rgba(24,208,174,.12)}.hero h1{font-family:var(--fd);font-size:clamp(54px,6.2vw,86px);line-height:.96;letter-spacing:-.058em;margin:24px 0 24px;max-width:700px}.hero h1 span{color:var(--deep);position:relative}.hero h1 span:after{content:'';position:absolute;left:2px;right:0;height:12px;bottom:4px;background:rgba(24,208,174,.3);z-index:-1;border-radius:50%}.hero-copy p{font-size:18px;line-height:1.75;color:var(--muted);max-width:600px}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin:32px 0 26px}.btn-hero{padding:16px 23px;border-radius:15px;font-size:15px}.btn-green{background:var(--green);color:var(--ink);box-shadow:0 14px 35px rgba(24,208,174,.28)}.hero-micro{display:flex;flex-wrap:wrap;gap:10px 18px;color:#547068;font-size:12.5px}.hero-micro span{display:flex;align-items:center;gap:7px}.hero-micro i{width:18px;height:18px;border-radius:50%;background:var(--mint);display:grid;place-items:center;font-style:normal;color:var(--deep);font-weight:800}
/* Hero product stage */
.product-stage{position:relative;min-height:610px}.stage-glow{position:absolute;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,rgba(24,208,174,.2),transparent 68%);right:-90px;top:-20px;filter:blur(6px)}.desktop{position:absolute;right:0;top:20px;width:92%;background:#fff;border:1px solid rgba(8,52,43,.12);border-radius:26px;box-shadow:0 35px 90px rgba(8,52,43,.18);overflow:hidden;transform:perspective(1200px) rotateY(-2deg) rotateX(1deg)}.desktop-top{height:50px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:7px;padding:0 18px;background:#fbfefd}.dot{width:9px;height:9px;border-radius:50%;background:#d8e6e1}.desktop-body{display:grid;grid-template-columns:150px 1fr;min-height:420px}.side{background:#0c241c;color:#fff;padding:18px 13px}.side-brand{display:flex;align-items:center;gap:8px;font-family:var(--fd);font-weight:800;font-size:13px;margin-bottom:20px}.mini-logo{width:28px;height:28px;border-radius:9px;background:var(--green);display:grid;place-items:center;color:var(--ink)}.side-item{padding:9px 10px;border-radius:10px;color:rgba(255,255,255,.55);font-size:10px;margin-bottom:4px}.side-item.active{background:rgba(24,208,174,.14);color:#fff}.dash{padding:22px;background:#f7fbfa}.dash-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.dash-head h3{font-family:var(--fd);font-size:21px;margin:0}.status{font-size:10px;font-weight:800;color:var(--deep);background:var(--mint);padding:7px 10px;border-radius:999px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.metric{background:#fff;border:1px solid var(--line);border-radius:15px;padding:13px}.metric small{color:var(--muted);font-size:9px}.metric b{display:block;font-family:var(--fd);font-size:23px;margin-top:5px}.dash-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:10px;margin-top:10px}.panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px}.panel-title{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}.visit{display:flex;justify-content:space-between;align-items:center;padding:10px;border-radius:12px;background:var(--mint2);margin-bottom:8px}.person{display:flex;gap:9px;align-items:center}.avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(145deg,#c9f6ec,#e7fbf7);display:grid;place-items:center;font-size:10px;font-weight:800}.person b{display:block;font-size:11px}.person span{font-size:9px;color:var(--muted)}.tag{font-size:8px;font-weight:800;padding:5px 7px;border-radius:999px;background:var(--mint);color:var(--deep)}.ai-card{background:linear-gradient(145deg,#0c241c,#103c31);color:#fff;border-radius:16px;padding:14px;min-height:132px}.ai-card strong{font-size:11px}.ai-card p{font-size:9.5px;line-height:1.55;color:rgba(255,255,255,.7);margin:9px 0}.ai-chip{display:inline-flex;font-size:8px;padding:5px 7px;border-radius:999px;background:rgba(24,208,174,.14);color:#a8f7e7}.floating{position:absolute;background:#fff;border:1px solid rgba(8,52,43,.1);box-shadow:var(--shadow2);border-radius:18px;z-index:4}.voice-card{left:0;bottom:80px;width:215px;padding:16px;animation:float 5s ease-in-out infinite}.voice-top{display:flex;justify-content:space-between;align-items:center}.voice-top b{font-size:11px}.voice-wave{height:44px;display:flex;align-items:center;gap:4px;margin:8px 0}.voice-wave i{width:4px;border-radius:8px;background:var(--green);animation:wave 1.1s ease-in-out infinite}.voice-wave i:nth-child(2){animation-delay:.1s}.voice-wave i:nth-child(3){animation-delay:.2s}.voice-wave i:nth-child(4){animation-delay:.3s}.voice-wave i:nth-child(5){animation-delay:.4s}.voice-wave i:nth-child(6){animation-delay:.5s}.voice-card p{font-size:9px;line-height:1.5;color:var(--muted)}.safety-card{right:-12px;bottom:20px;width:210px;padding:15px;animation:float 5.5s ease-in-out infinite reverse}.safety-row{display:flex;gap:10px;align-items:center}.shield{width:38px;height:38px;border-radius:12px;background:var(--mint);display:grid;place-items:center;font-size:18px}.safety-card b{font-size:11px}.safety-card p{font-size:9px;color:var(--muted);margin:2px 0 0}.phone{position:absolute;right:40px;top:305px;width:142px;background:#0b1f18;border-radius:27px;padding:7px;box-shadow:0 28px 55px rgba(11,31,24,.26);z-index:5;transform:rotate(4deg)}.phone-in{background:#fff;border-radius:21px;overflow:hidden}.phone-head{background:var(--green);padding:12px 9px 9px;font-size:8px;font-weight:800}.phone-body{padding:9px}.phone-card{background:var(--mint2);border:1px solid var(--line);padding:8px;border-radius:10px;margin-bottom:7px}.phone-card b{font-size:8px;display:block}.phone-card span{font-size:7px;color:var(--muted)}
@keyframes float{50%{transform:translateY(-9px)}}@keyframes wave{0%,100%{height:10px}50%{height:34px}}
/* VALUE STRIP */
.value-strip{position:relative;z-index:10;margin-top:-30px}.value-shell{background:var(--ink);border-radius:26px;padding:18px;display:grid;grid-template-columns:repeat(4,1fr);box-shadow:0 25px 60px rgba(11,31,24,.15)}.value{padding:20px 22px;color:#fff}.value+.value{border-left:1px solid rgba(255,255,255,.1)}.value-icon{width:38px;height:38px;border-radius:12px;background:rgba(24,208,174,.13);display:grid;place-items:center;margin-bottom:12px}.value h3{font-size:14px;margin:0 0 6px}.value p{font-size:11.5px;line-height:1.55;color:rgba(255,255,255,.55);margin:0}
/* PROBLEM */
.problem{background:var(--off)}.problem-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:70px;align-items:start}.problem-copy{position:sticky;top:120px}.pain-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.pain{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;min-height:190px;transition:.25s}.pain:hover{transform:translateY(-5px);box-shadow:var(--shadow2)}.pain-num{font-family:var(--fd);font-size:13px;color:var(--green2);font-weight:800}.pain h3{font-family:var(--fd);font-size:21px;margin:28px 0 9px;letter-spacing:-.02em}.pain p{font-size:13px;line-height:1.7;color:var(--muted)}
/* SHOWCASE */
.showcase-head{display:flex;justify-content:space-between;gap:40px;align-items:end}.tabs{display:flex;gap:7px;flex-wrap:wrap}.tab-btn{border:1px solid var(--line);background:#fff;color:#526960;padding:10px 13px;border-radius:999px;font-weight:700;font-size:12px;cursor:pointer}.tab-btn.active{background:var(--ink);color:#fff;border-color:var(--ink)}.showcase-card{margin-top:42px;background:linear-gradient(145deg,#0a251d,#0b3c31);border-radius:32px;padding:30px;display:grid;grid-template-columns:.78fr 1.22fr;gap:30px;min-height:550px;overflow:hidden;position:relative}.showcase-copy{color:#fff;padding:20px 8px 20px 12px;align-self:center}.showcase-copy .mini{color:var(--green);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}.showcase-copy h3{font-family:var(--fd);font-size:42px;line-height:1.05;letter-spacing:-.04em;margin:14px 0}.showcase-copy p{font-size:15px;line-height:1.75;color:rgba(255,255,255,.62)}.bullet-list{display:grid;gap:10px;margin-top:22px}.bullet{display:flex;gap:10px;align-items:flex-start;color:rgba(255,255,255,.78);font-size:13px}.bullet i{width:20px;height:20px;border-radius:50%;background:rgba(24,208,174,.16);display:grid;place-items:center;color:var(--green);font-style:normal;flex:0 0 auto}.showcase-ui{position:relative;background:#f7fbfa;border-radius:24px;padding:18px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}.feature-screen{height:100%;display:none}.feature-screen.active{display:block}.screen-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.screen-top h4{font-family:var(--fd);font-size:19px;margin:0}.screen-chip{font-size:9px;font-weight:800;padding:6px 8px;border-radius:999px;background:var(--mint);color:var(--deep)}.screen-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}.screen-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px}.med-row{display:grid;grid-template-columns:1fr auto;align-items:center;padding:10px 0;border-bottom:1px solid #edf3f1}.med-row:last-child{border-bottom:0}.med-row b{font-size:11px}.med-row span{font-size:9px;color:var(--muted)}.med-state{font-size:8px!important;font-weight:800;padding:5px 7px;border-radius:999px;background:var(--mint);color:var(--deep)!important}.note-box{background:var(--mint2);border:1px dashed #b9e8dd;border-radius:14px;padding:12px;font-size:10px;line-height:1.6;color:#45655a}.activity{display:flex;gap:9px;margin-bottom:12px}.activity i{width:8px;height:8px;background:var(--green);border-radius:50%;margin-top:4px}.activity b{display:block;font-size:10px}.activity span{font-size:9px;color:var(--muted)}
/* JOURNEY */
.journey{background:linear-gradient(180deg,#fff,#f8fcfb)}.journey-line{margin-top:46px;display:grid;grid-template-columns:repeat(4,1fr);position:relative}.journey-line:before{content:'';position:absolute;top:24px;left:10%;right:10%;height:2px;background:linear-gradient(90deg,var(--green),#b7e8de)}.jstep{position:relative;padding-right:22px}.jnum{width:48px;height:48px;border-radius:16px;background:#fff;border:1px solid #cfe9e3;display:grid;place-items:center;font-family:var(--fd);font-weight:800;position:relative;z-index:2;box-shadow:0 8px 24px rgba(8,52,43,.07)}.jstep h3{font-family:var(--fd);font-size:19px;margin:20px 0 8px}.jstep p{font-size:13px;line-height:1.7;color:var(--muted)}
/* ROLES */
.roles{background:var(--ink);color:#fff}.roles .h2{max-width:780px}.roles .lead{color:rgba(255,255,255,.55)}.roles-grid{display:grid;grid-template-columns:1.1fr .9fr .9fr;gap:14px;margin-top:44px}.role-card{border-radius:24px;padding:28px;min-height:360px;position:relative;overflow:hidden}.role-card.carer{background:linear-gradient(145deg,var(--green),#67ead4);color:var(--ink)}.role-card.supervisor,.role-card.manager{background:#102d24;border:1px solid rgba(255,255,255,.08)}.role-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;opacity:.7}.role-card h3{font-family:var(--fd);font-size:30px;line-height:1.08;letter-spacing:-.035em;margin:18px 0 12px}.role-card p{font-size:13px;line-height:1.7;opacity:.7}.role-list{margin-top:22px;display:grid;gap:9px}.role-list div{font-size:12px;display:flex;gap:9px}.role-list i{font-style:normal;font-weight:800}.role-orb{position:absolute;width:180px;height:180px;border-radius:50%;right:-60px;bottom:-60px;background:rgba(255,255,255,.13)}
/* AI SECTION */
.ai-section{background:#fff}.ai-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:65px;align-items:center}.ai-demo{background:linear-gradient(145deg,#0b2019,#0e382d);border-radius:30px;padding:24px;box-shadow:var(--shadow);min-height:480px;position:relative;overflow:hidden}.ai-demo:before{content:'';position:absolute;width:260px;height:260px;border-radius:50%;background:rgba(24,208,174,.12);right:-60px;top:-70px;filter:blur(6px)}.copilot-head{display:flex;justify-content:space-between;align-items:center;color:#fff}.copilot-head b{font-family:var(--fd);font-size:18px}.live-pill{font-size:9px;padding:6px 8px;border-radius:999px;background:rgba(24,208,174,.15);color:#8ff2dd}.prompt{margin-top:22px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);padding:13px;border-radius:14px;color:#fff;font-size:11px}.answer{margin-top:12px;background:#fff;border-radius:16px;padding:16px}.answer small{font-size:9px;color:var(--green2);font-weight:800;text-transform:uppercase}.answer h4{font-size:13px;margin:8px 0}.answer p{font-size:10px;line-height:1.65;color:var(--muted)}.alert-box{margin-top:12px;background:#fff7ea;border:1px solid #f4ddb5;border-radius:14px;padding:13px;font-size:10px;line-height:1.55;color:#765b26}.ai-points{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:28px}.ai-point{border:1px solid var(--line);border-radius:17px;padding:17px}.ai-point b{font-size:13px}.ai-point p{font-size:11px;line-height:1.6;color:var(--muted);margin:7px 0 0}
/* COMPLIANCE */
.compliance{background:var(--off)}.compliance-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:60px;align-items:center}.security-board{display:grid;grid-template-columns:1fr 1fr;gap:12px}.security-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px}.security-card.wide{grid-column:1/-1;background:var(--ink);color:#fff}.security-icon{width:42px;height:42px;border-radius:13px;background:var(--mint);display:grid;place-items:center;margin-bottom:18px}.security-card h3{font-family:var(--fd);font-size:18px;margin:0 0 7px}.security-card p{font-size:12px;line-height:1.65;color:var(--muted);margin:0}.security-card.wide p{color:rgba(255,255,255,.58)}
/* PRICING */
.pricing-head{display:flex;justify-content:space-between;align-items:end;gap:40px}.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:44px}.price-card{border:1px solid var(--line);border-radius:24px;padding:28px;background:#fff;position:relative}.price-card.featured{background:var(--ink);color:#fff;transform:translateY(-8px);box-shadow:var(--shadow)}.popular{position:absolute;top:-13px;left:24px;background:var(--green);color:var(--ink);font-size:10px;font-weight:800;padding:6px 10px;border-radius:999px}.plan{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}.price-card.featured .plan{color:rgba(255,255,255,.45)}.price{font-family:var(--fd);font-size:44px;font-weight:800;letter-spacing:-.04em;margin:16px 0 8px}.price span{font-family:var(--f);font-size:13px;font-weight:500;color:var(--muted)}.price-card.featured .price span{color:rgba(255,255,255,.45)}.price-desc{font-size:12px;line-height:1.65;color:var(--muted);min-height:42px}.price-card.featured .price-desc{color:rgba(255,255,255,.55)}.price-feats{display:grid;gap:10px;margin:24px 0}.price-feats div{font-size:12px;display:flex;gap:8px}.tick{color:var(--green);font-weight:900}.price-btn{width:100%;padding:13px 16px;border-radius:13px;border:1px solid var(--line);background:#fff;font-weight:800;cursor:pointer;font-family:var(--f)}.price-card.featured .price-btn{background:var(--green);border-color:var(--green);color:var(--ink)}
/* CTA */
.final-cta{padding:40px 0 80px}.cta-shell{background:linear-gradient(135deg,#0b1f18,#0b493b);border-radius:34px;padding:64px;display:grid;grid-template-columns:1fr auto;gap:35px;align-items:center;position:relative;overflow:hidden}.cta-shell:after{content:'';position:absolute;width:360px;height:360px;border-radius:50%;background:rgba(24,208,174,.12);right:-120px;top:-150px}.cta-shell h2{font-family:var(--fd);font-size:48px;line-height:1.04;letter-spacing:-.045em;color:#fff;margin:0 0 12px;max-width:680px}.cta-shell p{color:rgba(255,255,255,.58);font-size:14px;line-height:1.7}.cta-actions{display:flex;flex-direction:column;gap:10px;position:relative;z-index:2}.cta-actions .btn{min-width:190px}.cta-actions .btn-ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.2)}
/* FOOTER */
footer{background:#071a14;color:#fff;padding:58px 0 28px}.footer-grid{display:grid;grid-template-columns:1.6fr repeat(3,1fr);gap:40px}.footer-desc{font-size:12px;line-height:1.7;color:rgba(255,255,255,.42);max-width:300px;margin-top:14px}.footer-col h4{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.74);margin:0 0 15px}.footer-col a{display:block;color:rgba(255,255,255,.42);font-size:12px;margin-bottom:10px}.footer-bottom{border-top:1px solid rgba(255,255,255,.08);margin-top:34px;padding-top:22px;display:flex;justify-content:space-between;gap:20px;color:rgba(255,255,255,.28);font-size:11px}
/* ANIMATIONS */
@keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
@keyframes popIn{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes slideInScreen{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
@keyframes ringPulse{0%{box-shadow:0 0 0 0 rgba(24,208,174,.4)}70%{box-shadow:0 0 0 12px rgba(24,208,174,0)}100%{box-shadow:0 0 0 0 rgba(24,208,174,0)}}
@keyframes glowPulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.14);opacity:1}}
@keyframes drawLine{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes shine{from{transform:translateX(0) skewX(-18deg)}to{transform:translateX(420%) skewX(-18deg)}}
@keyframes gridPan{from{background-position:0 0}to{background-position:44px 44px}}
@keyframes orbDrift{0%,100%{transform:translate(0,0)}50%{transform:translate(-16px,-20px)}}
@keyframes phoneBob{0%,100%{transform:rotate(4deg)}50%{transform:rotate(4deg) translateY(-9px)}}
@keyframes caretBlink{0%,100%{opacity:1}50%{opacity:0}}
/* Hero entrance — staggered */
.hero-copy>*{animation:fadeUp .9s cubic-bezier(.22,.8,.3,1) both}
.hero-copy>*:nth-child(2){animation-delay:.1s}
.hero-copy>*:nth-child(3){animation-delay:.2s}
.hero-copy>*:nth-child(4){animation-delay:.3s}
.hero-copy>*:nth-child(5){animation-delay:.4s}
.hero h1 span:after{transform:scaleX(0);transform-origin:left;animation:drawLine .8s .8s cubic-bezier(.22,.8,.3,1) forwards}
/* Hero ambient */
.hero:before{animation:gridPan 16s linear infinite}
.stage-glow{animation:glowPulse 6s ease-in-out infinite}
.pulse{animation:ringPulse 2.2s infinite}
.status{animation:ringPulse 2.6s infinite}
.live-pill{animation:ringPulse 2.4s infinite}
/* Cursor parallax on product stage (vars set from JS) */
.product-stage{--rx:0deg;--ry:0deg;--tx:0px;--ty:0px}
.desktop{transform:perspective(1200px) rotateY(calc(-2deg + var(--ry))) rotateX(calc(1deg + var(--rx))) translate(var(--tx),var(--ty));transition:transform .25s ease-out}
.phone{animation:phoneBob 6s ease-in-out infinite}
/* Button shine sweep */
.btn{position:relative;overflow:hidden}
.btn-green:after,.btn-primary:after{content:'';position:absolute;top:-10%;bottom:-10%;width:34%;left:-50%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-18deg);pointer-events:none}
.btn-green:hover:after,.btn-primary:hover:after{animation:shine .7s ease}
/* Showcase tab transitions */
.tab-btn{transition:color .2s,background .2s,border-color .2s,transform .2s}
.tab-btn:hover{transform:translateY(-2px)}
.showcase-copy{animation:fadeUp .5s cubic-bezier(.22,.8,.3,1) both}
.feature-screen.active{animation:slideInScreen .45s cubic-bezier(.22,.8,.3,1) both}
/* Journey line draws across on scroll */
.journey-line:before{transform:scaleX(0);transform-origin:left;transition:transform 1.2s cubic-bezier(.22,.8,.3,1) .4s}
.journey-line.show:before{transform:scaleX(1)}
.jstep:nth-child(2){transition-delay:.1s}
.jstep:nth-child(3){transition-delay:.2s}
.jstep:nth-child(4){transition-delay:.3s}
/* Staggered card reveals */
.pain:nth-child(2){transition-delay:.07s}
.pain:nth-child(3){transition-delay:.14s}
.pain:nth-child(4){transition-delay:.21s}
.roles-grid .role-card:nth-child(2){transition-delay:.1s}
.roles-grid .role-card:nth-child(3){transition-delay:.2s}
.security-board .security-card:nth-child(2){transition-delay:.07s}
.security-board .security-card:nth-child(3){transition-delay:.14s}
.security-board .security-card:nth-child(4){transition-delay:.21s}
.security-board .security-card:nth-child(5){transition-delay:.28s}
.pricing-grid .price-card:nth-child(2){transition-delay:.1s}
.pricing-grid .price-card:nth-child(3){transition-delay:.2s}
/* Hover lifts */
.security-card,.ai-point,.role-card,.price-card{transition:transform .35s ease,box-shadow .35s ease,border-color .35s ease,opacity .7s ease}
.security-card:hover,.ai-point:hover{transform:translateY(-5px);box-shadow:var(--shadow2);border-color:#b9e8dd}
.role-card:hover{transform:translateY(-6px)}
.price-card:hover{transform:translateY(-6px);box-shadow:var(--shadow2)}
.price-card.featured:hover{transform:translateY(-12px)}
.role-orb{animation:orbDrift 7s ease-in-out infinite}
.value{transition:background .3s ease}
.value:hover{background:rgba(255,255,255,.04)}
.value-icon{transition:transform .3s ease}
.value:hover .value-icon{transform:scale(1.12) rotate(-6deg)}
.metric{transition:transform .25s ease,border-color .25s ease}
.metric:hover{transform:translateY(-3px);border-color:#b9e8dd}
/* Copilot demo typing */
.prompt .caret{display:inline-block;width:2px;height:1em;background:var(--green);vertical-align:-2px;margin-left:2px;animation:caretBlink .8s infinite}
.answer{animation:popIn .45s cubic-bezier(.22,.8,.3,1) both}
.alert-box{animation:fadeUp .5s .15s cubic-bezier(.22,.8,.3,1) both}
@media(max-width:1050px){.nav-links{display:none}.mobile-toggle{display:block}.hero-grid,.problem-grid,.ai-grid,.compliance-grid{grid-template-columns:1fr}.hero{padding-top:120px}.product-stage{min-height:620px}.problem-copy{position:static}.roles-grid{grid-template-columns:1fr 1fr}.role-card.carer{grid-column:1/-1}.showcase-card{grid-template-columns:1fr}.pricing-grid{grid-template-columns:1fr}.price-card.featured{transform:none}.cta-shell{grid-template-columns:1fr}.cta-actions{flex-direction:row}.footer-grid{grid-template-columns:1fr 1fr}}
@media(max-width:760px){.container{width:min(100% - 24px,1200px)}.section{padding:78px 0}.site-nav{padding:10px 0}.nav-actions .btn-ghost,.nav-actions .btn-primary{display:none}.hero{min-height:auto;padding:104px 0 55px}.hero-grid{gap:34px}.hero h1{font-size:52px}.product-stage{min-height:510px}.desktop{position:relative;width:100%;top:auto}.desktop-body{grid-template-columns:1fr}.side{display:none}.dash-grid,.screen-grid{grid-template-columns:1fr}.phone{right:10px;top:300px;width:120px}.voice-card{left:4px;bottom:10px;width:185px}.safety-card{display:none}.value-strip{margin-top:0}.value-shell{grid-template-columns:1fr 1fr}.value:nth-child(3){border-left:0}.value:nth-child(n+3){border-top:1px solid rgba(255,255,255,.1)}.problem-grid{gap:36px}.pain-grid{grid-template-columns:1fr}.showcase-head,.pricing-head{align-items:flex-start;flex-direction:column}.showcase-card{padding:18px}.showcase-copy h3{font-size:34px}.journey-line{grid-template-columns:1fr;gap:22px}.journey-line:before{display:none}.jstep{display:grid;grid-template-columns:48px 1fr;column-gap:16px}.jstep h3{margin:4px 0 6px}.jstep p{grid-column:2}.roles-grid,.ai-points,.security-board{grid-template-columns:1fr}.role-card.carer{grid-column:auto}.security-card.wide{grid-column:auto}.cta-shell{padding:38px 24px}.cta-shell h2{font-size:38px}.cta-actions{flex-direction:column}.footer-grid{grid-template-columns:1fr}.footer-bottom{flex-direction:column}.metrics{grid-template-columns:1fr 1fr}.metric:nth-child(3){grid-column:1/-1}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}.reveal{opacity:1;transform:none}}
`}</style>

      <header className={`site-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="container nav">
          <a href="/" className="brand">
            <span className="brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="#0b1f18" strokeWidth="2"><path d="M12 3v18M3 12h18" /></svg>
            </span>
            CAREi
          </a>
          <nav className="nav-links">
            <a href="#platform">Platform</a>
            <a href="#workflow">How it works</a>
            <a href="#roles">For teams</a>
            <a href="#security">Security</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="nav-actions">
            <a href={`${APP_URL}/login`}><button className="btn btn-ghost">Sign in</button></a>
            <a href="mailto:sales@careiapp.com"><button className="btn btn-primary">Book a demo</button></a>
            <button className="mobile-toggle">☰</button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy reveal">
              <div className="hero-badge"><span className="pulse"></span>AI-powered care management, built around the visit</div>
              <h1>Run safer, smarter care from <span>one connected platform.</span></h1>
              <p>CAREi helps carers document faster, supervisors respond sooner, and managers keep every visit, medication, handover and audit trail connected from one place.</p>
              <div className="hero-actions">
                <a href={`${APP_URL}/login`}><button className="btn btn-hero btn-green">Start free trial →</button></a>
                <a href="#platform"><button className="btn btn-hero btn-ghost">Watch product tour</button></a>
              </div>
              <div className="hero-micro">
                <span><i>✓</i>Voice-first documentation</span>
                <span><i>✓</i>Digital MAR</span>
                <span><i>✓</i>Lone-worker safety</span>
                <span><i>✓</i>Role-based oversight</span>
              </div>
            </div>
            <div className="product-stage reveal" ref={stageRef} onMouseMove={handleStageMove} onMouseLeave={resetStageTilt}>
              <div className="stage-glow"></div>
              <div className="desktop">
                <div className="desktop-top"><span className="dot"></span><span className="dot"></span><span className="dot"></span></div>
                <div className="desktop-body">
                  <aside className="side">
                    <div className="side-brand"><span className="mini-logo">C</span>CAREi</div>
                    <div className="side-item active">Overview</div>
                    <div className="side-item">Clients</div>
                    <div className="side-item">Visits</div>
                    <div className="side-item">Medication</div>
                    <div className="side-item">Care plans</div>
                    <div className="side-item">Alerts</div>
                    <div className="side-item">Reports</div>
                  </aside>
                  <div className="dash">
                    <div className="dash-head">
                      <div><small style={{ color: 'var(--muted)', fontSize: '9px' }}>Good morning, Sarah</small><h3>Care operations</h3></div>
                      <span className="status">● All systems normal</span>
                    </div>
                    <div className="metrics">
                      <div className="metric"><small>Visits today</small><b data-count="28">0</b></div>
                      <div className="metric"><small>Active now</small><b data-count="7">0</b></div>
                      <div className="metric"><small>Needs attention</small><b data-count="3">0</b></div>
                    </div>
                    <div className="dash-grid">
                      <div className="panel">
                        <div className="panel-title">Live visits</div>
                        <div className="visit"><div className="person"><div className="avatar">ME</div><div><b>Margaret Ellis</b><span>Bristol · 09:15</span></div></div><span className="tag">In progress</span></div>
                        <div className="visit"><div className="person"><div className="avatar">JB</div><div><b>John Baker</b><span>Bath · 09:30</span></div></div><span className="tag">Medication due</span></div>
                        <div className="visit"><div className="person"><div className="avatar">AM</div><div><b>Ada Mensah</b><span>Bristol · 10:00</span></div></div><span className="tag">Scheduled</span></div>
                      </div>
                      <div className="ai-card">
                        <strong>CAREi Copilot</strong>
                        <p>Margaret is 750ml below today’s fluid target. Penicillin allergy is on file. Ankle swelling was noted on the previous visit.</p>
                        <span className="ai-chip">Review insight →</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="floating voice-card">
                <div className="voice-top"><b>Voice documentation</b><span style={{ fontSize: '9px', color: 'var(--green2)' }}>Recording</span></div>
                <div className="voice-wave"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                <p>“Client ate most of breakfast, medication taken, mild swelling still present...”</p>
              </div>
              <div className="floating safety-card">
                <div className="safety-row"><div className="shield">🛡</div><div><b>Lone-worker safety</b><p>Heartbeat received · 18 sec ago</p></div></div>
              </div>
              <div className="phone">
                <div className="phone-in">
                  <div className="phone-head">Active visit · Margaret</div>
                  <div className="phone-body">
                    <div className="phone-card"><b>Medication</b><span>2 of 3 confirmed</span></div>
                    <div className="phone-card"><b>Vitals</b><span>BP 128/76 · Pulse 71</span></div>
                    <div className="phone-card"><b>Handover</b><span>Generated at clock-out</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* VALUE STRIP */}
        <div className="value-strip">
          <div className="container">
            <div className="value-shell reveal">
              <div className="value"><div className="value-icon">◌</div><h3>One connected record</h3><p>Visits, notes, medication, care plans and alerts stay together around the client.</p></div>
              <div className="value"><div className="value-icon">⌁</div><h3>Less typing, more care</h3><p>Voice capture and progressive documentation reduce the burden of end-of-shift admin.</p></div>
              <div className="value"><div className="value-icon">⌖</div><h3>Safer lone working</h3><p>Built-in check-ins, GPS-aware alerts and supervisor escalation support carers in the field.</p></div>
              <div className="value"><div className="value-icon">✓</div><h3>Audit-ready by design</h3><p>Timestamped, role-based records make review, reporting and inspection preparation simpler.</p></div>
            </div>
          </div>
        </div>

        {/* PROBLEM */}
        <section className="section problem">
          <div className="container problem-grid">
            <div className="problem-copy reveal">
              <div className="eyebrow">Why CAREi</div>
              <h2 className="h2">Care teams do not need more software. They need less friction.</h2>
              <p className="lead">CAREi is designed around what actually happens before, during and after a care visit — so carers can focus on people while managers keep visibility without chasing paperwork.</p>
            </div>
            <div className="pain-grid">
              <article className="pain reveal"><div className="pain-num">01</div><h3>Documentation that happens during care</h3><p>Capture notes by voice, confirm medication in a few taps and progressively build the visit record instead of completing a long form afterwards.</p></article>
              <article className="pain reveal"><div className="pain-num">02</div><h3>Handovers that do not depend on memory</h3><p>Important observations and outstanding actions can flow directly into the next carer’s briefing.</p></article>
              <article className="pain reveal"><div className="pain-num">03</div><h3>Alerts that reach the right person</h3><p>Supervisors can see exceptions, safety concerns and visit issues as they happen instead of discovering them at the end of the day.</p></article>
              <article className="pain reveal"><div className="pain-num">04</div><h3>Records managers can actually use</h3><p>Searchable, structured information turns everyday care activity into operational visibility and audit evidence.</p></article>
            </div>
          </div>
        </section>

        {/* PLATFORM SHOWCASE */}
        <section id="platform" className="section">
          <div className="container">
            <div className="showcase-head">
              <div className="reveal">
                <div className="eyebrow">See the platform</div>
                <h2 className="h2">One system. Different jobs. One shared picture of care.</h2>
              </div>
              <div className="tabs reveal">
                {TABS.map((t) => (
                  <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="showcase-card reveal">
              <div className="showcase-copy" key={tab}>
                <div className="mini">{feature.k}</div>
                <h3>{feature.t}</h3>
                <p>{feature.x}</p>
                <div className="bullet-list">
                  {feature.b.map((item) => (
                    <div className="bullet" key={item}><i>✓</i>{item}</div>
                  ))}
                </div>
              </div>
              <div className="showcase-ui">
                <div className={`feature-screen${tab === 'visit' ? ' active' : ''}`}>
                  <div className="screen-top"><h4>Active visit · Margaret Ellis</h4><span className="screen-chip">Live</span></div>
                  <div className="screen-grid">
                    <div className="screen-panel">
                      <div className="panel-title">Today’s care</div>
                      <div className="med-row"><div><b>Morning medication</b><span>Complete before 10:00</span></div><span className="med-state">2 of 3</span></div>
                      <div className="med-row"><div><b>Breakfast &amp; fluids</b><span>Track intake</span></div><span className="med-state">In progress</span></div>
                      <div className="med-row"><div><b>Mobility support</b><span>Use walking frame</span></div><span className="med-state">Due</span></div>
                    </div>
                    <div className="screen-panel">
                      <div className="panel-title">Care context</div>
                      <div className="note-box">Penicillin allergy on file. Previous visit noted mild ankle swelling. Fluid target today: 1.5L.</div>
                    </div>
                  </div>
                </div>
                <div className={`feature-screen${tab === 'meds' ? ' active' : ''}`}>
                  <div className="screen-top"><h4>Digital MAR</h4><span className="screen-chip">Audit trail active</span></div>
                  <div className="screen-panel">
                    <div className="med-row"><div><b>Amlodipine · 5mg</b><span>09:21 · Confirmed by M. Evans</span></div><span className="med-state">Given</span></div>
                    <div className="med-row"><div><b>Lisinopril · 10mg</b><span>09:22 · Confirmed by M. Evans</span></div><span className="med-state">Given</span></div>
                    <div className="med-row"><div><b>Simvastatin · 20mg</b><span>Scheduled for evening round</span></div><span className="med-state">Pending</span></div>
                  </div>
                </div>
                <div className={`feature-screen${tab === 'handover' ? ' active' : ''}`}>
                  <div className="screen-top"><h4>ContinuCare+ handover</h4><span className="screen-chip">Generated</span></div>
                  <div className="screen-panel">
                    <div className="activity"><i></i><div><b>Observation</b><span>Mild ankle swelling remains present; no pain reported.</span></div></div>
                    <div className="activity"><i></i><div><b>Medication</b><span>Morning medication completed as scheduled.</span></div></div>
                    <div className="activity"><i></i><div><b>Next action</b><span>Continue fluid encouragement; review intake at next visit.</span></div></div>
                  </div>
                </div>
                <div className={`feature-screen${tab === 'oversight' ? ' active' : ''}`}>
                  <div className="screen-top"><h4>Supervisor overview</h4><span className="screen-chip">Live operations</span></div>
                  <div className="screen-grid">
                    <div className="screen-panel">
                      <div className="panel-title">Needs attention</div>
                      <div className="visit"><div className="person"><div className="avatar">ME</div><div><b>Margaret Ellis</b><span>Fluid target below plan</span></div></div><span className="tag">Review</span></div>
                      <div className="visit"><div className="person"><div className="avatar">JB</div><div><b>John Baker</b><span>Medication not yet confirmed</span></div></div><span className="tag">Due</span></div>
                    </div>
                    <div className="screen-panel">
                      <div className="panel-title">Safety</div>
                      <div className="note-box">All active lone-worker heartbeats received. No open SOS incidents.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* JOURNEY */}
        <section id="workflow" className="section journey">
          <div className="container">
            <div className="eyebrow reveal">The visit journey</div>
            <h2 className="h2 reveal">From clock-in to handover, CAREi follows the work instead of interrupting it.</h2>
            <p className="lead reveal">A single flow connects location, client context, care delivery, documentation, AI support and the final record.</p>
            <div className="journey-line reveal">
              <div className="jstep reveal"><div className="jnum">1</div><div><h3>Arrive informed</h3><p>Clock in, verify the visit and see the latest care plan, tasks, risks and handover information.</p></div></div>
              <div className="jstep reveal"><div className="jnum">2</div><div><h3>Deliver and capture</h3><p>Complete care, confirm medication, record observations and dictate notes while the visit is still happening.</p></div></div>
              <div className="jstep reveal"><div className="jnum">3</div><div><h3>Catch what matters</h3><p>CAREi Copilot can surface relevant context and exceptions so carers and supervisors know what deserves attention.</p></div></div>
              <div className="jstep reveal"><div className="jnum">4</div><div><h3>Leave a clear record</h3><p>Clock out with a structured visit record and a concise handover ready for the next person in the care journey.</p></div></div>
            </div>
          </div>
        </section>

        {/* ROLES */}
        <section id="roles" className="section roles">
          <div className="container">
            <div className="eyebrow" style={{ color: 'var(--green)' }}>Built for the whole team</div>
            <h2 className="h2 reveal">Different roles see what they need. Everyone works from the same care record.</h2>
            <p className="lead reveal">CAREi connects frontline work to supervision and management without turning every user into an administrator.</p>
            <div className="roles-grid">
              <article className="role-card carer reveal">
                <div className="role-label">Frontline carers</div>
                <h3>Spend less of the shift documenting the shift.</h3>
                <p>Fast access to client context, voice notes, medication, vitals, tasks and safety controls in one visit workflow.</p>
                <div className="role-list">
                  <div><i>✓</i>Voice-first notes</div>
                  <div><i>✓</i>Medication in a few taps</div>
                  <div><i>✓</i>Briefings before each visit</div>
                  <div><i>✓</i>SOS and passive safety support</div>
                </div>
                <div className="role-orb"></div>
              </article>
              <article className="role-card supervisor reveal">
                <div className="role-label">Supervisors</div>
                <h3>See exceptions before they become end-of-day surprises.</h3>
                <p>Stay close to active visits, alerts, medication issues and lone-worker safety without calling every carer for updates.</p>
                <div className="role-list">
                  <div><i>✓</i>Live visit visibility</div>
                  <div><i>✓</i>Priority alerts</div>
                  <div><i>✓</i>Acknowledge and escalate</div>
                </div>
              </article>
              <article className="role-card manager reveal">
                <div className="role-label">Care managers</div>
                <h3>Turn everyday care activity into operational control.</h3>
                <p>Review records, care plans, compliance evidence and team activity from one management view.</p>
                <div className="role-list">
                  <div><i>✓</i>Structured audit trails</div>
                  <div><i>✓</i>Reports and exports</div>
                  <div><i>✓</i>Role-based permissions</div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* AI */}
        <section className="section ai-section">
          <div className="container ai-grid">
            <div className="ai-demo reveal" ref={demoRef}>
              <div className="copilot-head"><b>CAREi Copilot</b><span className="live-pill">Grounded in client context</span></div>
              <div className="prompt">{typed || '\u00A0'}{!showAnswer && <span className="caret" />}</div>
              {showAnswer && (
                <>
                  <div className="answer">
                    <small>CAREi response</small>
                    <h4>Three things need your attention</h4>
                    <p>1. Fluid intake is below today’s target.<br />2. Penicillin allergy remains active on the record.<br />3. Mild ankle swelling was documented on the previous visit.</p>
                  </div>
                  <div className="alert-box"><b>Safety note:</b> AI suggestions are presented for human review. The carer remains responsible for the care decision and saved record.</div>
                </>
              )}
            </div>
            <div className="reveal">
              <div className="eyebrow">AI that supports care</div>
              <h2 className="h2">Useful context, without turning care into a chatbot.</h2>
              <p className="lead">CAREi Copilot is designed to help people notice, retrieve and structure information already connected to the client and visit. It supports the workflow; it does not replace professional judgement.</p>
              <div className="ai-points">
                <div className="ai-point"><b>Ask in plain language</b><p>Use voice or text to retrieve relevant client context while working.</p></div>
                <div className="ai-point"><b>Structure voice notes</b><p>Turn spoken observations into organised documentation for review.</p></div>
                <div className="ai-point"><b>Surface relevant flags</b><p>Bring allergies, previous observations and care-plan context closer to the moment of care.</p></div>
                <div className="ai-point"><b>Keep humans in control</b><p>AI-generated content is reviewed before it becomes part of the official record.</p></div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPLIANCE */}
        <section id="security" className="section compliance">
          <div className="container compliance-grid">
            <div className="reveal">
              <div className="eyebrow">Security &amp; compliance</div>
              <h2 className="h2">The care record should be easy to use — and difficult to compromise.</h2>
              <p className="lead">CAREi is designed with multi-tenant isolation, role-based permissions, secure authentication, audit logging and protected client data as core platform principles.</p>
            </div>
            <div className="security-board">
              <div className="security-card wide reveal"><div className="security-icon">🔒</div><h3>One accountable trail from action to record</h3><p>Important activity can be timestamped, attributed to a user and retained as part of the visit history, supporting internal review and inspection preparation.</p></div>
              <div className="security-card reveal"><div className="security-icon">👤</div><h3>Role-based access</h3><p>Users see the information and tools appropriate to their responsibility.</p></div>
              <div className="security-card reveal"><div className="security-icon">🛡</div><h3>Tenant isolation</h3><p>Provider data remains scoped to its own organisation environment.</p></div>
              <div className="security-card reveal"><div className="security-icon">🔑</div><h3>Secure sign-in</h3><p>Support for modern authentication and protected token handling.</p></div>
              <div className="security-card reveal"><div className="security-icon">🧾</div><h3>Audit logging</h3><p>Key system events can be recorded for accountability and review.</p></div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="section">
          <div className="container">
            <div className="pricing-head">
              <div className="reveal">
                <div className="eyebrow">Pricing</div>
                <h2 className="h2">Start with what your team needs now. Expand when you are ready.</h2>
              </div>
              <p className="lead reveal" style={{ maxWidth: '420px' }}>Simple per-carer plans for smaller providers, with a custom option for larger and multi-site organisations.</p>
            </div>
            <div className="pricing-grid">
              {plans.map((plan) => {
                const { price, unit } = getPricingDisplay(plan)
                const featured = plan.slug === 'professional'
                const features = PLAN_FEATURES[plan.slug] || []
                const desc = PLAN_DESCRIPTIONS[plan.slug] || ''
                const cta = PLAN_CTA[plan.slug] || 'Start free trial'
                const ctaHref = plan.billing_model === 'custom' ? 'mailto:sales@careiapp.com' : `${APP_URL}/login`
                return (
                  <div className={`price-card reveal${featured ? ' featured' : ''}`} key={plan.slug}>
                    {featured && <div className="popular">Most popular</div>}
                    <div className="plan">{plan.name}</div>
                    <div className="price">{price} {unit && <span>{unit}</span>}</div>
                    <p className="price-desc">{desc}</p>
                    <div className="price-feats">
                      {features.map((f) => (
                        <div key={f}><span className="tick">✓</span>{f}</div>
                      ))}
                    </div>
                    <a href={ctaHref}><button className="price-btn">{cta}</button></a>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final-cta">
          <div className="container">
            <div className="cta-shell reveal">
              <div>
                <h2>Make every visit easier to deliver, easier to oversee and easier to prove.</h2>
                <p>See how CAREi can bring documentation, medication, handovers, safety and management visibility into one connected care workflow.</p>
              </div>
              <div className="cta-actions">
                <a href="mailto:sales@careiapp.com"><button className="btn btn-green">Book a live demo</button></a>
                <a href={`${APP_URL}/login`}><button className="btn btn-ghost">Start free trial</button></a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div>
              <a href="/" className="brand">
                <span className="brand-mark">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0b1f18" strokeWidth="2"><path d="M12 3v18M3 12h18" /></svg>
                </span>
                CAREi
              </a>
              <p className="footer-desc">A connected care-management platform for carers, supervisors and managers — from the first clock-in to the final audit trail.</p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#platform">Platform</a>
              <a href="#workflow">Workflow</a>
              <a href="#roles">For teams</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <a href="mailto:sales@careiapp.com">Contact</a>
            </div>
            <div className="footer-col">
              <h4>Trust</h4>
              <a href="#security">Security</a>
              <a href="/privacy-policy.html">Privacy</a>
              <a href="/terms-of-service.html">Terms</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 CAREi. All rights reserved.</span>
            <span>Care technology designed around the people delivering care.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
