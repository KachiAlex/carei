import { useEffect, useState } from 'react'

const APP_URL = 'https://app.careiapp.com'
const API_BASE = 'https://api.careiapp.com/api'

interface Plan {
  slug: string
  name: string
  max_users: number
  max_clients: number
  price_per_carer: number
  billing_model: string
  is_default: boolean
}

const FALLBACK_PLANS: Plan[] = [
  { slug: 'trial', name: 'Starter', max_users: 5, max_clients: 10, price_per_carer: 8, billing_model: 'per-carer', is_default: true },
  { slug: 'professional', name: 'Professional', max_users: 25, max_clients: 50, price_per_carer: 14, billing_model: 'per-carer', is_default: false },
  { slug: 'enterprise', name: 'Enterprise', max_users: 100, max_clients: 500, price_per_carer: 0, billing_model: 'custom', is_default: false },
]

const PLAN_FEATURES: Record<string, string[]> = {
  trial: [
    'Digital MAR and handover',
    'Lone worker SOS',
    'Vital signs and fluid tracking',
    'Supervisor dashboard',
    'UK data hosting',
  ],
  professional: [
    'Everything in Starter',
    'AI Copilot and voice documentation',
    'AI care plan creator',
    'Audio shift briefing',
    'Passive lone worker monitoring',
    'CQC audit export and reporting',
  ],
  enterprise: [
    'Everything in Professional',
    'Dedicated account manager',
    'Custom integrations (EMIS, SystmOne)',
    'SLA-backed uptime',
    'On-site training and DSPT support',
  ],
}

const PLAN_DESCRIPTIONS: Record<string, string> = {
  trial: 'For small care teams making the move to digital records.',
  professional: 'For providers who need AI documentation and full compliance tools.',
  enterprise: 'For multi-site providers and NHS Integrated Care Boards.',
}

function getPricingDisplay(plan: Plan): { price: string; unit: string } {
  if (plan.billing_model === 'custom' || plan.price_per_carer === 0) {
    return { price: 'Custom', unit: '' }
  }
  const priceStr = `\u00a3${plan.price_per_carer}`
  const unitStr = plan.billing_model === 'per-carer' ? '/ carer / mo' : `/ ${plan.billing_model}`
  return { price: priceStr, unit: unitStr }
}

export default function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS)
  const [plansLoading, setPlansLoading] = useState(true)

  useEffect(() => {
    window.scrollTo(0, 0)
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
      .finally(() => setPlansLoading(false))
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#ffffff' }}>
      <style>{`
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --g:#0ecfb0;--gd:#09b89c;--gdk:#085041;
  --gl:#e8faf7;--gll:#f3fdfb;--gm:#c5f5ed;
  --ink:#0b1f18;--ink2:#1e3d30;--muted:#4d7266;
  --white:#ffffff;--off:#f8fdfb;
  --f:'DM Sans',sans-serif;--fd:'Playfair Display',serif;
}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;}
body{font-family:var(--f);background:var(--white);color:var(--ink);overflow-x:hidden;line-height:1.5;}

/* NAV */
nav{display:flex;align-items:center;justify-content:space-between;padding:0 56px;height:68px;border-bottom:1px solid rgba(14,207,176,0.15);background:rgba(255,255,255,0.96);position:sticky;top:0;z-index:100;backdrop-filter:blur(8px);}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;}
.logo-mark{
  width:38px;height:38px;border-radius:10px;
  background:var(--g);
  display:flex;align-items:center;justify-content:center;
  overflow:hidden;flex-shrink:0;
}
.logo-mark img{width:100%;height:100%;object-fit:cover;}
.logo-name{font-size:19px;font-weight:700;color:var(--ink);letter-spacing:-0.4px;}
.logo-name sup{font-size:10px;font-weight:400;color:var(--muted);}
.nav-links{display:flex;gap:32px;list-style:none;}
.nav-links a{font-size:13.5px;color:var(--muted);text-decoration:none;font-weight:500;transition:color .2s;}
.nav-links a:hover{color:var(--ink);}
.nav-cta{display:flex;gap:10px;align-items:center;}
.btn-ghost{
  background:transparent;border:1.5px solid rgba(14,207,176,0.5);
  color:var(--gdk);padding:8px 20px;border-radius:9px;
  font-size:13.5px;font-weight:600;font-family:var(--f);cursor:pointer;
  transition:border-color .25s ease,box-shadow .25s ease;
}
.btn-ghost:hover{border-color:var(--g);box-shadow:0 2px 12px rgba(14,207,176,0.15);}
.btn-primary{
  background:var(--g);color:var(--ink);padding:9px 22px;border-radius:9px;
  font-size:13.5px;font-weight:700;border:none;font-family:var(--f);cursor:pointer;
  transition:background .25s ease,box-shadow .25s ease;
}
.btn-primary:hover{background:var(--gd);box-shadow:0 4px 16px rgba(14,207,176,0.3);}

/* HERO */
.hero{
  background:linear-gradient(180deg,var(--off) 0%,var(--white) 100%);
  padding:80px 56px 80px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;min-height:600px;overflow:hidden;position:relative;
}
.hero-left{display:flex;flex-direction:column;justify-content:center;}
.hero-eyebrow{
  display:inline-flex;align-items:center;gap:8px;background:var(--white);border:1.5px solid var(--gm);padding:6px 15px;border-radius:24px;font-size:12px;font-weight:600;color:var(--gdk);letter-spacing:0.3px;margin-bottom:28px;box-shadow:0 1px 8px rgba(14,207,176,0.06);
}
.hero-eyebrow span{width:7px;height:7px;border-radius:50%;background:var(--g);display:block;}
h1{font-family:var(--fd);font-size:62px;line-height:1.05;color:var(--ink);letter-spacing:-1.5px;margin-bottom:22px;}
h1 em{font-style:italic;color:var(--gdk);}
.hero-sub{font-size:17px;color:var(--muted);line-height:1.7;max-width:420px;font-weight:300;margin-bottom:36px;}
.hero-actions{display:flex;gap:14px;align-items:center;margin-bottom:44px;}
.btn-hero{
  background:var(--ink);color:var(--white);padding:15px 32px;border-radius:12px;font-size:15px;font-weight:700;border:none;font-family:var(--f);cursor:pointer;transition:transform .2s ease,box-shadow .2s ease;
}
.btn-hero:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(11,31,24,0.25);}
.btn-hero-out{
  background:transparent;border:1.5px solid var(--gm);color:var(--gdk);padding:15px 26px;border-radius:12px;font-size:15px;font-weight:600;font-family:var(--f);cursor:pointer;transition:border-color .25s ease,background .25s ease;
}
.btn-hero-out:hover{border-color:var(--g);background:var(--gll);}
.trust-badges{display:flex;gap:10px;flex-wrap:wrap;}
.tbadge{
  display:flex;align-items:center;gap:6px;background:var(--white);border:1px solid rgba(14,207,176,0.2);padding:7px 13px;border-radius:8px;font-size:12px;font-weight:500;color:var(--ink2);transition:border-color .2s ease;box-shadow:0 1px 4px rgba(0,0,0,0.03);
}
.tbadge:hover{border-color:var(--g);}
.tbadge svg{width:14px;height:14px;flex-shrink:0;}
.hero-right{position:relative;display:flex;align-items:center;justify-content:center;min-height:480px;}
.hg-bg-shape{position:absolute;right:-20px;bottom:-40px;width:440px;height:440px;background:var(--gll);border-radius:50% 50% 0 0 / 60% 60% 0 0;}
.hg-circle-ring{position:absolute;right:20px;top:-10px;width:300px;height:300px;border-radius:50%;border:1.5px solid rgba(14,207,176,0.2);}
.hg-circle-ring2{position:absolute;right:50px;top:10px;width:240px;height:240px;border-radius:50%;border:1px solid rgba(14,207,176,0.1);}
.app-card{
  position:relative;z-index:2;background:var(--white);border-radius:22px;border:1px solid rgba(14,207,176,0.2);overflow:hidden;margin:0 24px;box-shadow:0 12px 48px rgba(14,207,176,0.12),0 2px 8px rgba(0,0,0,0.04);
}
.app-header{background:var(--g);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;}
.app-header-left{display:flex;align-items:center;gap:10px;}
.app-av{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--ink);}
.app-title{font-size:13px;font-weight:700;color:var(--ink);}
.app-sub{font-size:11px;color:rgba(8,80,65,0.7);}
.live-dot{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--gdk);background:rgba(255,255,255,0.85);padding:4px 10px;border-radius:20px;}
.live-dot::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--gd);}
.app-body{padding:16px;}
.client-row{display:flex;align-items:center;justify-content:space-between;background:var(--gll);border:1px solid rgba(14,207,176,0.15);border-radius:12px;padding:12px 14px;margin-bottom:12px;}
.cr-name{font-size:13px;font-weight:600;color:var(--ink);}
.cr-addr{font-size:11px;color:var(--muted);margin-top:2px;}
.cr-time{background:var(--g);color:var(--gdk);font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;}
.meds-label{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;}
.meds-row{display:flex;gap:7px;margin-bottom:12px;}
.med{flex:1;border-radius:10px;padding:9px 10px;text-align:center;border:1px solid rgba(0,0,0,0.06);}
.med.done{background:var(--gl);border-color:rgba(14,207,176,0.25);}
.med.pend{background:#fafafa;}
.med-name{font-size:10px;font-weight:600;color:var(--ink2);}
.med-dose{font-size:9px;color:var(--muted);margin-top:2px;}
.med-tick{width:16px;height:16px;border-radius:50%;background:var(--g);display:flex;align-items:center;justify-content:center;margin:0 auto 4px;}
.med-tick svg{width:9px;height:9px;}
.med-wait{width:16px;height:16px;border-radius:50%;border:1.5px solid rgba(0,0,0,0.12);margin:0 auto 4px;}
.ai-banner{background:var(--gll);border:1px solid rgba(14,207,176,0.25);border-radius:12px;padding:11px 13px;}
.ai-label{font-size:9px;font-weight:700;color:var(--gdk);text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;display:flex;align-items:center;gap:4px;}
.ai-text{font-size:11px;color:var(--ink2);line-height:1.55;}
.float-card{
  position:absolute;background:var(--white);border:1px solid rgba(14,207,176,0.2);border-radius:14px;padding:12px 14px;z-index:10;box-shadow:0 8px 32px rgba(14,207,176,0.12),0 2px 8px rgba(0,0,0,0.06);
}
.fc-sos{top:20px;right:-10px;display:flex;align-items:center;gap:9px;}
.sos-btn{width:36px;height:36px;border-radius:50%;background:#fee2e2;border:1.5px solid #fca5a5;display:flex;align-items:center;justify-content:center;}
.sos-btn svg{width:16px;height:16px;stroke:#dc2626;stroke-width:2;fill:none;}
.fc-sos-text p{font-size:12px;font-weight:600;color:var(--ink);}
.fc-sos-text span{font-size:10px;color:var(--muted);}
.fc-stat{bottom:60px;left:-20px;}
.fc-stat-n{font-size:22px;font-weight:700;color:var(--g);font-family:var(--fd);}
.fc-stat-l{font-size:10px;color:var(--muted);font-weight:500;}
.graphic-band{
  background:linear-gradient(135deg,var(--g) 0%,var(--gd) 100%);padding:64px 56px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;
}
.gb-item{padding:0 32px;text-align:center;}
.gb-item+.gb-item{border-left:1px solid rgba(8,80,65,0.15);}
.gb-num{font-family:var(--fd);font-size:52px;font-weight:900;color:var(--ink);line-height:1;}
.gb-label{font-size:13px;font-weight:600;color:var(--gdk);margin-top:6px;}
.gb-sub{font-size:12px;color:rgba(8,80,65,0.6);margin-top:3px;}
.sec-wide{padding:88px 0;}
.sec-wide .sec-inner{padding:0 56px;max-width:1200px;margin:0 auto;}
.sec-bg{background:var(--off);}
.sec-bg2{background:var(--gl);}
.sec-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--gdk);letter-spacing:.5px;margin-bottom:14px;}
.sec-tag::before{content:'';width:24px;height:2px;background:var(--g);border-radius:1px;}
.sec-h{font-family:var(--fd);font-size:44px;line-height:1.1;color:var(--ink);letter-spacing:-1px;margin-bottom:14px;}
.sec-sub{font-size:16px;color:var(--muted);line-height:1.7;font-weight:300;max-width:520px;}
.feat-layout{display:grid;grid-template-columns:380px 1fr;gap:64px;align-items:start;}
.feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.feat-card{
  background:var(--white);border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:24px;transition:border-color .3s ease,transform .3s ease,box-shadow .3s ease;box-shadow:0 1px 4px rgba(0,0,0,0.02);
}
.feat-card:hover{border-color:var(--g);transform:translateY(-3px);box-shadow:0 8px 28px rgba(14,207,176,0.1);}
.feat-card.highlight{background:var(--ink);border-color:var(--ink);}
.feat-card.highlight h3{color:var(--white);}
.feat-card.highlight p{color:rgba(255,255,255,0.55);}
.feat-icon{
  width:44px;height:44px;border-radius:12px;background:var(--gl);border:1px solid rgba(14,207,176,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:16px;transition:background .3s ease;
}
.feat-card:hover .feat-icon{background:var(--gm);}
.feat-icon.dark{background:rgba(14,207,176,0.15);border-color:rgba(14,207,176,0.3);}
.feat-icon svg{width:20px;height:20px;stroke:var(--gdk);stroke-width:1.8;fill:none;}
.feat-icon.dark svg{stroke:var(--g);}
.new-badge{display:inline-block;background:var(--gm);color:var(--gdk);font-size:10px;font-weight:700;padding:2px 9px;border-radius:5px;margin-bottom:10px;letter-spacing:.2px;}
.feat-card h3{font-size:15px;font-weight:600;color:var(--ink);margin-bottom:7px;}
.feat-card p{font-size:13px;color:var(--muted);line-height:1.6;}
.how-wrap{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;}
.steps-list{display:flex;flex-direction:column;gap:0;}
.step-item{display:flex;gap:20px;padding:24px 0;border-bottom:1px solid rgba(14,207,176,0.12);}
.step-item:first-child{padding-top:0;}
.step-item:last-child{border-bottom:none;}
.step-num{width:40px;height:40px;border-radius:50%;background:var(--g);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--fd);font-size:16px;font-weight:700;color:var(--ink);}
.step-content h3{font-size:16px;font-weight:600;color:var(--ink);margin-bottom:6px;}
.step-content p{font-size:13.5px;color:var(--muted);line-height:1.6;}
.how-visual{
  background:var(--gll);border-radius:24px;border:1px solid rgba(14,207,176,0.15);padding:32px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 24px rgba(14,207,176,0.06);
}
.flow-row{
  background:var(--white);border-radius:12px;padding:14px 16px;border:1px solid rgba(0,0,0,0.05);display:flex;align-items:center;gap:12px;transition:border-color .25s ease,box-shadow .25s ease;
}
.flow-row:hover{border-color:rgba(14,207,176,0.3);box-shadow:0 2px 12px rgba(14,207,176,0.06);}
.flow-icon{width:34px;height:34px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.flow-icon.g{background:var(--g);}
.flow-icon.gl{background:var(--gl);border:1px solid rgba(14,207,176,0.2);}
.flow-icon svg{width:16px;height:16px;stroke-width:2;fill:none;}
.flow-icon.g svg{stroke:var(--ink);}
.flow-icon.gl svg{stroke:var(--gdk);}
.flow-text p{font-size:13px;font-weight:600;color:var(--ink);}
.flow-text span{font-size:11px;color:var(--muted);}
.flow-arrow{margin:0 auto;width:1px;height:14px;background:rgba(14,207,176,0.3);}
.flow-row.active{border-color:var(--g);background:var(--gll);}
.personas-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:52px;}
.persona{border-radius:20px;padding:32px;border:1px solid rgba(0,0,0,0.06);transition:transform .3s ease,box-shadow .3s ease;}
.persona:hover{transform:translateY(-3px);box-shadow:0 12px 36px rgba(14,207,176,0.1);}
.persona.p-carer{background:var(--ink);color:var(--white);}
.persona.p-sup{background:var(--white);}
.persona.p-mgr{background:var(--gl);}
.p-role-tag{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-bottom:14px;display:inline-block;}
.p-carer .p-role-tag{color:var(--g);}
.p-sup .p-role-tag,.p-mgr .p-role-tag{color:var(--gdk);}
.persona h3{font-size:22px;font-weight:700;font-family:var(--fd);margin-bottom:10px;line-height:1.2;}
.p-carer h3{color:var(--white);}
.p-sup h3,.p-mgr h3{color:var(--ink);}
.persona-desc{font-size:13.5px;line-height:1.65;margin-bottom:22px;font-weight:300;}
.p-carer .persona-desc{color:rgba(255,255,255,0.6);}
.p-sup .persona-desc,.p-mgr .persona-desc{color:var(--muted);}
.p-list{list-style:none;}
.p-list li{font-size:13px;padding:6px 0;display:flex;gap:9px;align-items:flex-start;border-bottom:1px solid rgba(255,255,255,0.07);}
.p-sup .p-list li,.p-mgr .p-list li{border-color:rgba(14,207,176,0.1);}
.p-list li:last-child{border-bottom:none;}
.p-carer .p-list li{color:rgba(255,255,255,0.8);}
.p-sup .p-list li,.p-mgr .p-list li{color:var(--ink2);}
.p-check{flex-shrink:0;margin-top:2px;}
.p-carer .p-check svg{stroke:var(--g);}
.p-sup .p-check svg,.p-mgr .p-check svg{stroke:var(--gdk);}
.comp-layout{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;}
.comp-visual{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.comp-card{background:var(--white);border-radius:16px;border:1px solid rgba(0,0,0,0.06);padding:22px;transition:border-color .25s ease;box-shadow:0 1px 4px rgba(0,0,0,0.02);}
.comp-card:hover{border-color:rgba(14,207,176,0.3);}
.comp-card.big{grid-column:1/-1;background:var(--ink);border-color:var(--ink);}
.comp-icon{width:40px;height:40px;border-radius:11px;background:var(--gl);border:1px solid rgba(14,207,176,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:12px;}
.comp-icon svg{width:20px;height:20px;stroke:var(--gdk);stroke-width:1.8;fill:none;}
.comp-card h4{font-size:14px;font-weight:600;color:var(--ink);margin-bottom:4px;}
.comp-card p{font-size:12px;color:var(--muted);line-height:1.55;}
.comp-card.big h4{color:var(--g);}
.comp-card.big p{color:rgba(255,255,255,0.55);font-size:13px;}
.comp-points{display:flex;flex-direction:column;gap:16px;margin-top:32px;}
.cp{display:flex;align-items:flex-start;gap:12px;}
.cp-bullet{width:22px;height:22px;border-radius:50%;background:var(--gl);border:1px solid rgba(14,207,176,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.cp-bullet svg{width:11px;height:11px;stroke:var(--gdk);stroke-width:2.5;fill:none;}
.cp h5{font-size:14px;font-weight:600;color:var(--ink);margin-bottom:3px;}
.cp p{font-size:13px;color:var(--muted);line-height:1.55;}
.testi-intro{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:40px;}
.testi-rating{background:var(--gl);border:1px solid rgba(14,207,176,0.2);border-radius:12px;padding:16px 22px;text-align:center;}
.rating-n{font-family:var(--fd);font-size:40px;font-weight:700;color:var(--g);}
.rating-stars{color:var(--g);font-size:16px;margin:3px 0;}
.rating-sub{font-size:11px;color:var(--muted);}
.testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.tcard{background:var(--white);border:1px solid rgba(0,0,0,0.06);border-radius:18px;padding:28px;transition:transform .3s ease,box-shadow .3s ease;}
.tcard:hover{transform:translateY(-3px);box-shadow:0 12px 36px rgba(14,207,176,0.08);}
.tcard.featured{background:var(--gll);border-color:rgba(14,207,176,0.25);}
.tquote{font-family:var(--fd);font-size:15px;font-style:italic;color:var(--ink2);line-height:1.65;margin-bottom:22px;}
.tcard .tquote::before{content:'\\201C';font-size:36px;color:var(--g);line-height:0;vertical-align:-14px;margin-right:2px;}
.t-auth{display:flex;align-items:center;gap:10px;border-top:1px solid rgba(14,207,176,0.12);padding-top:16px;}
.t-av{width:38px;height:38px;border-radius:50%;background:var(--gm);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--gdk);}
.t-name{font-size:13px;font-weight:600;color:var(--ink);}
.t-role{font-size:11px;color:var(--muted);}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:52px;}
.pcard{background:var(--white);border:1px solid rgba(0,0,0,0.07);border-radius:20px;padding:32px;position:relative;transition:transform .3s ease,box-shadow .3s ease;}
.pcard:hover{transform:translateY(-4px);box-shadow:0 16px 48px rgba(0,0,0,0.08);}
.pcard.feat{background:var(--ink);border-color:var(--ink);}
.p-pop{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--g);color:var(--gdk);font-size:11px;font-weight:700;padding:4px 16px;border-radius:20px;white-space:nowrap;}
.p-plan{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;}
.pcard.feat .p-plan{color:rgba(255,255,255,0.4);}
.p-price{font-family:var(--fd);font-size:44px;font-weight:700;color:var(--ink);margin-bottom:6px;line-height:1;}
.pcard.feat .p-price{color:var(--white);}
.p-unit{font-family:var(--f);font-size:14px;font-weight:400;color:var(--muted);}
.pcard.feat .p-unit{color:rgba(255,255,255,0.4);}
.p-desc{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:22px;min-height:40px;}
.pcard.feat .p-desc{color:rgba(255,255,255,0.5);}
.p-divider{height:1px;background:rgba(0,0,0,0.07);margin-bottom:20px;}
.pcard.feat .p-divider{background:rgba(255,255,255,0.1);}
.p-feats{list-style:none;margin-bottom:28px;}
.p-feats li{display:flex;align-items:flex-start;gap:9px;font-size:13px;padding:6px 0;color:var(--ink2);border-bottom:1px solid rgba(0,0,0,0.05);}
.p-feats li:last-child{border-bottom:none;}
.pcard.feat .p-feats li{color:rgba(255,255,255,0.7);border-color:rgba(255,255,255,0.07);}
.p-feats li svg{width:14px;height:14px;stroke:var(--g);stroke-width:2.5;fill:none;flex-shrink:0;margin-top:2px;}
.pbtn{width:100%;padding:13px;border-radius:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--f);border:none;}
.pbtn-outline{background:transparent;border:1.5px solid rgba(0,0,0,0.15)!important;color:var(--ink);}
.pbtn-solid{background:var(--g);color:var(--gdk);}
.pbtn-white{background:var(--white);color:var(--ink);}
.cta-banner{
  background:linear-gradient(135deg,var(--g) 0%,var(--gd) 100%);padding:88px 56px;display:grid;grid-template-columns:1fr auto;gap:48px;align-items:center;
}
.cta-left h2{font-family:var(--fd);font-size:48px;line-height:1.08;color:var(--ink);letter-spacing:-1px;margin-bottom:12px;}
.cta-left p{font-size:16px;color:var(--gdk);font-weight:400;max-width:480px;}
.cta-right{display:flex;flex-direction:column;gap:12px;align-items:flex-end;}
.btn-cta-dark{background:var(--ink);color:var(--white);padding:15px 36px;border-radius:12px;font-size:15px;font-weight:700;border:none;font-family:var(--f);cursor:pointer;white-space:nowrap;transition:transform .2s ease,box-shadow .2s ease;}
.btn-cta-dark:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(11,31,24,0.3);}
.btn-cta-out{background:transparent;border:2px solid var(--gdk);color:var(--gdk);padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;font-family:var(--f);cursor:pointer;white-space:nowrap;transition:background .25s ease;}
.btn-cta-out:hover{background:rgba(8,80,65,0.06);}
.cta-meta{font-size:12px;color:var(--gdk);text-align:right;}
footer{background:var(--ink);padding:60px 56px 36px;}
.foot-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;max-width:1200px;margin:0 auto 40px;}
.foot-brand-desc{font-size:13px;color:rgba(255,255,255,0.4);line-height:1.7;margin-top:12px;max-width:240px;}
.foot-col h4{font-size:12px;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:16px;letter-spacing:.3px;}
.foot-col a{display:block;font-size:13px;color:rgba(255,255,255,0.4);text-decoration:none;margin-bottom:10px;transition:color .2s;}
.foot-col a:hover{color:var(--g);text-decoration:underline;text-underline-offset:3px;}
.foot-bottom{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.07);}
.foot-bottom p{font-size:11.5px;color:rgba(255,255,255,0.25);}
.foot-live{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:500;color:var(--g);}
.foot-live::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--g);}
svg.icon-check{display:block;}

@media (max-width: 1024px){.hero{grid-template-columns:1fr;padding:60px 32px 0;text-align:center;}.hero-sub{margin:0 auto 36px;}.hero-actions{justify-content:center;}.trust-badges{justify-content:center;}.hero-right{margin-top:40px;}.feat-layout{grid-template-columns:1fr;gap:32px;}.how-wrap{grid-template-columns:1fr;gap:40px;}.comp-layout{grid-template-columns:1fr;gap:40px;}.testi-intro{flex-direction:column;align-items:flex-start;gap:24px;}}
@media (max-width: 900px){nav{padding:0 24px;}.nav-links{display:none;}.nav-cta .btn-ghost{display:none;}h1{font-size:42px;}.sec-h{font-size:32px;}.sec-wide{padding:56px 0;}.sec-wide .sec-inner{padding-left:20px;padding-right:20px;}.feat-grid{grid-template-columns:1fr;}.personas-grid{grid-template-columns:1fr;}.testi-grid{grid-template-columns:1fr;}.pricing-grid{grid-template-columns:1fr;max-width:480px;margin:52px auto 0;}.graphic-band{grid-template-columns:1fr 1fr;gap:24px;padding:40px 24px;}.gb-item+.gb-item{border-left:none;}.gb-item:nth-child(odd){border-right:1px solid rgba(8,80,65,0.2);}.cta-banner{grid-template-columns:1fr;padding:56px 24px;text-align:center;}.cta-right{align-items:center;}.foot-grid{grid-template-columns:1fr 1fr;}.foot-bottom{flex-direction:column;gap:12px;}}
@media (max-width: 640px){h1{font-size:36px;}.sec-h{font-size:28px;}.hero-actions{flex-direction:column;width:100%;}.hero-actions button{width:100%;}.foot-grid{grid-template-columns:1fr;}.graphic-band{grid-template-columns:1fr;}.gb-item+.gb-item{border-left:none;border-top:1px solid rgba(8,80,65,0.2);}.gb-item:nth-child(odd){border-right:none;}}
`}</style>

      {/* NAV */}
      <nav>
        <a className="logo" href="/">
          <div className="logo-mark"><img src="/logo.jpg" alt="CAREi" /></div>
          <span className="logo-name">CAREi<sup>&trade;</sup></span>
        </a>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how">How it works</a></li>
          <li><a href="#compliance">Compliance</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href={`${APP_URL}/manager/login`}>For managers</a></li>
        </ul>
        <div className="nav-cta">
          <a href={`${APP_URL}/login`}><button className="btn-ghost">Sign in</button></a>
          <a href={`${APP_URL}/login`}><button className="btn-primary">Start free trial</button></a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-eyebrow"><span></span>Now with AI Copilot and voice documentation</div>
          <h1>Care that<br /><em>documents</em><br />itself</h1>
          <p className="hero-sub">AI-powered care management for frontline UK carers. Voice notes, digital MAR, instant handovers — CQC-ready from day one.</p>
          <div className="hero-actions">
            <a href={`${APP_URL}/login`}><button className="btn-hero">Start free trial</button></a>
            <a href="#demo"><button className="btn-hero-out">Watch a demo</button></a>
          </div>
          <div className="trust-badges">
            <div className="tbadge"><svg viewBox="0 0 24 24" fill="none" stroke="#085041" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>GDPR ready</div>
            <div className="tbadge"><svg viewBox="0 0 24 24" fill="none" stroke="#085041" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>End-to-end encrypted</div>
            <div className="tbadge"><svg viewBox="0 0 24 24" fill="none" stroke="#085041" strokeWidth="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>CQC audit-ready</div>
            <div className="tbadge"><svg viewBox="0 0 24 24" fill="none" stroke="#085041" strokeWidth="2"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0H5m14 0a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2m14 0V9a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v12"/></svg>NHS-aligned</div>
          </div>
        </div>
        <div className="hero-right">
          <div className="hg-bg-shape"></div>
          <div className="hg-circle-ring"></div>
          <div className="hg-circle-ring2"></div>
          <div className="float-card fc-sos">
            <div className="sos-btn"><svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M12 2l10 17H2L12 2z" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <div className="fc-sos-text"><p>SOS activated</p><span>Supervisor notified — 28 sec</span></div>
          </div>
          <div className="float-card fc-stat">
            <div className="fc-stat-n">–70%</div>
            <div className="fc-stat-l">less documentation time</div>
          </div>
          <div className="app-card">
            <div className="app-header">
              <div className="app-header-left">
                <div className="app-av">ME</div>
                <div><div className="app-title">Active visit</div><div className="app-sub">Margaret Ellis · Bristol BS3</div></div>
              </div>
              <div className="live-dot">Live</div>
            </div>
            <div className="app-body">
              <div className="client-row">
                <div><div className="cr-name">Margaret Ellis, 84</div><div className="cr-addr">12 Elmwood Close · 09:15 AM · 45 min</div></div>
                <div className="cr-time">In progress</div>
              </div>
              <div className="meds-label">Medications — 2 of 3 confirmed</div>
              <div className="meds-row">
                <div className="med done"><div className="med-tick"><svg viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#085041" strokeWidth="1.8" strokeLinecap="round"/></svg></div><div className="med-name">Amlodipine</div><div className="med-dose">5mg</div></div>
                <div className="med done"><div className="med-tick"><svg viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#085041" strokeWidth="1.8" strokeLinecap="round"/></svg></div><div className="med-name">Lisinopril</div><div className="med-dose">10mg</div></div>
                <div className="med pend"><div className="med-wait"></div><div className="med-name">Simvastatin</div><div className="med-dose">Pending</div></div>
              </div>
              <div className="ai-banner">
                <div className="ai-label"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#085041" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>AI Copilot</div>
                <div className="ai-text">Fluid target 1.5L today — 750ml logged. Penicillin allergy on file. Ankle swelling flagged last visit.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAND */}
      <div className="graphic-band">
        <div className="gb-item"><div className="gb-num">200+</div><div className="gb-label">Care homes</div><div className="gb-sub">Live across the UK</div></div>
        <div className="gb-item"><div className="gb-num">15K+</div><div className="gb-label">Shifts logged</div><div className="gb-sub">Every month</div></div>
        <div className="gb-item"><div className="gb-num">99.9%</div><div className="gb-label">Uptime</div><div className="gb-sub">SLA-backed</div></div>
        <div className="gb-item"><div className="gb-num">4.9★</div><div className="gb-label">App Store</div><div className="gb-sub">From 1,200 carers</div></div>
      </div>

      {/* FEATURES */}
      <section id="features" className="sec-wide sec-bg">
        <div className="sec-inner">
          <div className="feat-layout">
            <div>
              <div className="sec-tag">Platform features</div>
              <h2 className="sec-h">Everything a carer needs. Nothing they don't.</h2>
              <p className="sec-sub" style={{ marginBottom: '28px' }}>CAREi v5.0 ships 14 features across 24 screens — designed with frontline carers, built for CQC, and proven to cut documentation time by over 70%.</p>
              <div className="feat-card" style={{ marginTop: '8px' }}>
                <div className="feat-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></div>
                <div className="new-badge">New in v5.0</div>
                <h3>AI Copilot — ask anything, mid-visit</h3>
                <p>Voice or text. Answers grounded in the client's care record. Proactive allergy and contraindication alerts. Responds in under 3 seconds.</p>
              </div>
            </div>
            <div className="feat-grid">
              <div className="feat-card"><div className="feat-icon"><svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg></div><div className="new-badge">New</div><h3>Voice documentation</h3><p>Narrate observations. AI transcribes and structures data for review. Original audio stored for audit.</p></div>
              <div className="feat-card"><div className="feat-icon"><svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6"/><path d="M9 12l2 2 4-4"/></svg></div><h3>Digital MAR</h3><p>Per-medication confirmation. Mandatory skip reasons. CQC-auditable records with GPS and timestamp.</p></div>
              <div className="feat-card"><div className="feat-icon"><svg viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg></div><h3>ContinuCare+ handover</h3><p>3-point briefing auto-generated at clock-out in under 10 seconds. Visible to the next carer immediately.</p></div>
              <div className="feat-card"><div className="feat-icon"><svg viewBox="0 0 24 24"><path d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"/></svg></div><h3>Lone worker SOS</h3><p>One-tap emergency button on every screen. Supervisor receives GPS location in under 30 seconds.</p></div>
              <div className="feat-card"><div className="feat-icon"><svg viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/></svg></div><div className="new-badge">New</div><h3>Passive safety monitoring</h3><p>Always-on GPS heartbeat. Screen inactivity triggers check-in. Auto-escalation to supervisor.</p></div>
              <div className="feat-card"><div className="feat-icon"><svg viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></div><div className="new-badge">New</div><h3>AI care plan creator</h3><p>Generates CQC-aligned care plans from assessment input. Human-reviewed. Never auto-saves.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="sec-wide">
        <div className="sec-inner">
          <div className="how-wrap">
            <div>
              <div className="sec-tag">How it works</div>
              <h2 className="sec-h">From clock-in to handover in one flow</h2>
              <p className="sec-sub" style={{ marginBottom: '36px' }}>No forms at end of shift. No chasing carers by phone. No paperwork before the next visit starts.</p>
              <div className="steps-list">
                <div className="step-item"><div className="step-num">1</div><div className="step-content"><h3>Clock in — GPS-verified</h3><p>Activates the visit. Audio briefing plays automatically while the carer travels. Briefing covers observations, open tasks, and flags from the last visit.</p></div></div>
                <div className="step-item"><div className="step-num">2</div><div className="step-content"><h3>Deliver care — document by voice</h3><p>Confirm medications in 2 taps. Log vitals contextually. Track fluids with a counter. Narrate observations — AI structures them in the background.</p></div></div>
                <div className="step-item"><div className="step-num">3</div><div className="step-content"><h3>AI reviews and flags</h3><p>Copilot surfaces alerts, flags anomalies, and monitors lone worker safety throughout the visit — passively, with no extra steps from the carer.</p></div></div>
                <div className="step-item"><div className="step-num">4</div><div className="step-content"><h3>Clock out — handover generated</h3><p>3-point briefing auto-generated in under 10 seconds. Supervisor notified. Audit trail sealed. No forms, no summary, no typing.</p></div></div>
              </div>
            </div>
            <div className="how-visual">
              <div className="flow-row active"><div className="flow-icon g"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" stroke="#0b1f18"/><circle cx="12" cy="11" r="3" stroke="#0b1f18"/></svg></div><div className="flow-text"><p>Clock-in verified</p><span>09:12 AM · Bristol BS3 4NR</span></div></div>
              <div className="flow-arrow"></div>
              <div className="flow-row"><div className="flow-icon gl"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="#085041"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="#085041"/></svg></div><div className="flow-text"><p>Audio briefing played</p><span>3 flags · 4 tasks · 2 medications</span></div></div>
              <div className="flow-arrow"></div>
              <div className="flow-row"><div className="flow-icon gl"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6" stroke="#085041"/><path d="M9 12l2 2 4-4" stroke="#085041"/></svg></div><div className="flow-text"><p>3 medications confirmed</p><span>MAR record sealed · GPS logged</span></div></div>
              <div className="flow-arrow"></div>
              <div className="flow-row"><div className="flow-icon gl"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><circle cx="12" cy="12" r="10" stroke="#085041"/><path d="M12 8v4l3 3" stroke="#085041"/></svg></div><div className="flow-text"><p>AI Copilot alert</p><span>Fluid target 750ml short — flagged</span></div></div>
              <div className="flow-arrow"></div>
              <div className="flow-row active"><div className="flow-icon g"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M5 13l4 4L19 7" stroke="#0b1f18"/></svg></div><div className="flow-text"><p>Handover generated</p><span>Supervisor notified · Audit complete</span></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* FOR WHOM */}
      <section className="sec-wide sec-bg">
        <div className="sec-inner">
          <div className="sec-tag">Built for every role</div>
          <h2 className="sec-h">One platform, every perspective</h2>
          <div className="personas-grid">
            <div className="persona p-carer">
              <div className="p-role-tag">Frontline carers</div>
              <h3>Less admin,<br />more care</h3>
              <p className="persona-desc">Everything you need is on one screen, exactly when you need it. No paper, no chasing, no forms at end of shift.</p>
              <ul className="p-list">
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Voice notes — no typing mid-visit</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Medication confirmation in 2 taps</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>SOS button always within reach</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Briefing plays on the way to each visit</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Progressive capture — no end-of-shift forms</li>
              </ul>
            </div>
            <div className="persona p-sup">
              <div className="p-role-tag">Supervisors</div>
              <h3>Real-time<br />oversight</h3>
              <p className="persona-desc">Push alerts the moment something needs attention. Acknowledge from the notification tray without opening the app.</p>
              <ul className="p-list">
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Push alerts for every flagged visit</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Out-of-range vitals escalated instantly</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>SOS location visible within 30 seconds</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Auto-escalation if unacknowledged at 15 min</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Lone worker monitoring across every shift</li>
              </ul>
            </div>
            <div className="persona p-mgr">
              <div className="p-role-tag">Care managers</div>
              <h3>CQC-ready,<br />always</h3>
              <p className="persona-desc">Every visit generates a complete timestamped audit trail — exportable, searchable, and built for inspection day.</p>
              <ul className="p-list">
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Full MAR history with PDF export</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Immutable incident records</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>AI care plan and report generation</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Live compliance dashboard</li>
                <li><span className="p-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></span>Manager portal — full team overview</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* COMPLIANCE */}
      <section id="compliance" className="sec-wide">
        <div className="sec-inner">
          <div className="comp-layout">
            <div>
              <div className="sec-tag">Compliance and security</div>
              <h2 className="sec-h">Built for the NHS.<br />Trusted by CQC.</h2>
              <p className="sec-sub" style={{ marginBottom: '0' }}>Designed alongside UK care providers and legal advisors from day one — not retrofitted after the fact.</p>
              <div className="comp-points">
                <div className="cp"><div className="cp-bullet"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></div><div><h5>Immutable audit trails</h5><p>Every action timestamped, GPS-tagged, and carer-attributed. Cannot be edited or deleted after submission.</p></div></div>
                <div className="cp"><div className="cp-bullet"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></div><div><h5>End-to-end encryption</h5><p>All client data encrypted in transit and at rest. UK data residency guaranteed on every plan.</p></div></div>
                <div className="cp"><div className="cp-bullet"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></div><div><h5>AI with human oversight</h5><p>Every AI suggestion is human-reviewed before saving. No auto-decisions. Explainable outputs aligned to CQC AI guidance (May 2026).</p></div></div>
                <div className="cp"><div className="cp-bullet"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round"/></svg></div><div><h5>Role-based access control</h5><p>Carers see only their clients. Supervisors see their team. Managers see everything.</p></div></div>
              </div>
            </div>
            <div className="comp-visual">
              <div className="comp-card big">
                <div className="comp-icon" style={{ background: 'rgba(14,207,176,0.15)', borderColor: 'rgba(14,207,176,0.3)' }}><svg viewBox="0 0 24 24" fill="none" stroke="#0ecfb0" strokeWidth="1.8"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div>
                <h4>DSPT aligned</h4>
                <p>NHS Data Security and Protection Toolkit standards met across every feature — data handling, access control, audit, and breach response.</p>
              </div>
              <div className="comp-card"><div className="comp-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#085041" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><h4>GDPR ready</h4><p>UK GDPR compliant. Data never leaves UK servers. Consent-logged family updates.</p></div>
              <div className="comp-card"><div className="comp-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#085041" strokeWidth="1.8"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z"/></svg></div><h4>CQC audit-ready</h4><p>Every record built to withstand inspection. MAR, handover, and incident records all included.</p></div>
              <div className="comp-card"><div className="comp-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#085041" strokeWidth="1.8"><path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z"/></svg></div><h4>ISO 27001</h4><p>Information security management certified. Full penetration testing cycle.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="sec-wide sec-bg2">
        <div className="sec-inner">
          <div className="testi-intro">
            <div><div className="sec-tag">What care homes say</div><h2 className="sec-h" style={{ marginBottom: '0' }}>Trusted across 200+ care homes</h2></div>
            <div className="testi-rating"><div className="rating-n">4.9</div><div className="rating-stars">★★★★★</div><div className="rating-sub">From 1,200+ carer reviews</div></div>
          </div>
          <div className="testi-grid">
            <div className="tcard featured"><p className="tquote">Since deploying CAREi, our carers spend 40% less time on documentation. They actually talk to residents now instead of filling forms at the end of every visit.</p><div className="t-auth"><div className="t-av">SR</div><div><div className="t-name">Sarah Redmond</div><div className="t-role">Care Home Manager · Bristol</div></div></div></div>
            <div className="tcard"><p className="tquote">The SOS feature was worth it alone. A lone worker activated it during a home visit — supervisor had location and was en route in under two minutes.</p><div className="t-auth"><div className="t-av">DT</div><div><div className="t-name">David Thornton</div><div className="t-role">Operations Director · Midlands</div></div></div></div>
            <div className="tcard"><p className="tquote">Our last CQC inspection went without a single documentation query. The auditor said our MAR records were the most complete they'd seen from a provider our size.</p><div className="t-auth"><div className="t-av">AM</div><div><div className="t-name">Amara Mensah</div><div className="t-role">Registered Manager · London</div></div></div></div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="sec-wide">
        <div className="sec-inner">
          <div style={{ maxWidth: '520px' }}>
            <div className="sec-tag">Pricing</div>
            <h2 className="sec-h">Simple, per-carer pricing</h2>
            <p className="sec-sub">No setup fees. No long contracts. Cancel anytime. Every plan includes GDPR-compliant UK hosting.</p>
          </div>
          <div className="pricing-grid">
            {plans.map((plan, idx) => {
              const isFeatured = idx === 1 || (plans.length === 2 && idx === 1)
              const isCustom = plan.billing_model === 'custom' || plan.price_per_carer === 0
              const { price, unit } = getPricingDisplay(plan)
              const features = PLAN_FEATURES[plan.slug] || PLAN_FEATURES[plan.name.toLowerCase()] || []
              const description = PLAN_DESCRIPTIONS[plan.slug] || PLAN_DESCRIPTIONS[plan.name.toLowerCase()] || ''
              const isTrial = plan.slug === 'trial' || plan.name.toLowerCase() === 'starter'
              const btnClass = isFeatured ? 'pbtn pbtn-white' : isCustom ? 'pbtn pbtn-outline' : 'pbtn pbtn-outline'
              const btnText = isCustom ? 'Talk to sales' : 'Start free trial'
              const btnHref = isCustom ? 'mailto:sales@careiapp.com' : `${APP_URL}/login`
              return (
                <div key={plan.slug} className={`pcard${isFeatured ? ' feat' : ''}`}>
                  {isFeatured && <div className="p-pop">Most popular</div>}
                  <div className="p-plan">{plan.name}</div>
                  <div className="p-price" style={isCustom ? { fontSize: '32px', paddingTop: '6px' } : undefined}>
                    {price}{!isCustom && unit && <span className="p-unit"> {unit}</span>}
                  </div>
                  <div className="p-desc">{description}</div>
                  <div className="p-divider"></div>
                  <ul className="p-feats">
                    {features.map((feat, i) => (
                      <li key={i}>
                        <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" stroke={isFeatured ? '#0ecfb0' : 'currentColor'}/></svg>
                        {feat}
                      </li>
                    ))}
                    {!isCustom && (
                      <>
                        <li>
                          <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" stroke={isFeatured ? '#0ecfb0' : 'currentColor'}/></svg>
                          Up to {plan.max_users} carers
                        </li>
                        <li>
                          <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" stroke={isFeatured ? '#0ecfb0' : 'currentColor'}/></svg>
                          Up to {plan.max_clients} clients
                        </li>
                      </>
                    )}
                  </ul>
                  <a href={btnHref}><button className={btnClass}>{btnText}</button></a>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <div id="demo" className="cta-banner">
        <div className="cta-left">
          <h2>Ready to free your carers<br />from paperwork?</h2>
          <p>Join 200+ care homes already running CAREi. Set up in under a day, trained in under an hour.</p>
        </div>
        <div className="cta-right">
          <a href={`${APP_URL}/login`}><button className="btn-cta-dark">Start 30-day free trial</button></a>
          <a href="mailto:sales@careiapp.com"><button className="btn-cta-out">Book a live demo</button></a>
          <div className="cta-meta">No credit card required · UK data hosting · Cancel anytime</div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="foot-grid">
          <div>
            <div className="logo">
              <div className="logo-mark" style={{ background: 'var(--g)' }}><img src="/logo.jpg" alt="CAREi" /></div>
              <span className="logo-name" style={{ color: '#fff' }}>CAREi<sup style={{ color: 'rgba(255,255,255,.3)' }}>&trade;</sup></span>
            </div>
            <p className="foot-brand-desc">AI-powered care management for frontline carers. Built in the UK, trusted across 200+ care homes.</p>
          </div>
          <div className="foot-col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href={`${APP_URL}/manager/login`}>Manager portal</a>
            <a href="#">Changelog</a>
          </div>
          <div className="foot-col">
            <h4>Compliance</h4>
            <a href="#compliance">GDPR and data</a>
            <a href="#compliance">DSPT alignment</a>
            <a href="#compliance">CQC readiness</a>
            <a href="#compliance">Security</a>
          </div>
          <div className="foot-col">
            <h4>Company</h4>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Careers</a>
            <a href="#">Contact</a>
            <a href="#">Privacy policy</a>
          </div>
        </div>
        <div className="foot-bottom">
          <p>&copy; 2026 CAREi Technologies Limited (SC893547). Registered in England and Wales. light@careiapp.com</p>
          <div className="foot-live">Live across 200+ care homes</div>
        </div>
      </footer>
    </div>
  )
}
