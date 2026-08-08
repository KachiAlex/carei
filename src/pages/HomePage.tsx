import { useEffect } from 'react'
import { useLocation } from 'wouter'

const siteHtml = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --navy: #0d1b2e;
  --navy-mid: #132340;
  --teal: #0ecfb0;
  --teal-dark: #0aa890;
  --teal-glow: rgba(14,207,176,0.12);
  --teal-muted: rgba(14,207,176,0.18);
  --white: #ffffff;
  --off-white: #e8f0f8;
  --text-dim: rgba(200,220,240,0.65);
  --card-bg: rgba(255,255,255,0.04);
  --card-border: rgba(14,207,176,0.14);
  --radius-card: 16px;
  --font-display: 'Playfair Display', serif;
  --font-body: 'DM Sans', sans-serif;
}

.site { font-family: var(--font-body); background: var(--navy); color: var(--white); }

/* ── NAV ── */
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 48px; border-bottom: 1px solid rgba(255,255,255,0.06);
  position: sticky; top: 0; z-index: 100;
  background: rgba(13,27,46,0.92); backdrop-filter: blur(12px);
}
.nav-logo { display: flex; align-items: center; gap: 10px; }
.nav-logo-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: #fff; display: block; object-fit: contain;
  padding: 3px;
}
.nav-logo-name { font-size: 20px; font-weight: 600; letter-spacing: -0.3px; }
.nav-links { display: flex; gap: 32px; }
.nav-links a { color: var(--text-dim); text-decoration: none; font-size: 14px; transition: color .2s; cursor: pointer; }
.nav-links a:hover { color: var(--white); }
.nav-cta { display: flex; gap: 12px; align-items: center; }
a.nav-logo { text-decoration: none; color: var(--white); }
.btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--white); padding: 9px 20px; border-radius: 8px; font-size: 14px; font-family: var(--font-body); cursor: pointer; transition: border-color .2s, color .2s; }
.btn-ghost:hover { border-color: var(--teal); color: var(--teal); }
.btn-teal { background: var(--teal); color: var(--navy); padding: 9px 22px; border-radius: 8px; font-size: 14px; font-weight: 600; border: none; font-family: var(--font-body); cursor: pointer; transition: background .2s; }
.btn-teal:hover { background: var(--teal-dark); }

/* linkified buttons */
a.btn-hero, a.btn-demo, a.btn-teal, a.btn-ghost, a.price-btn { text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }

/* ── HERO ── */
.hero {
  padding: 100px 48px 80px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center;
  max-width: 1200px; margin: 0 auto;
  background-image: url('/hero.png');
  background-repeat: no-repeat;
  background-position: right center;
  background-size: contain;
  position: relative;
  min-height: 600px;
}
.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--teal-muted); border: 1px solid rgba(14,207,176,0.3);
  color: var(--teal); padding: 6px 14px; border-radius: 20px; font-size: 12px;
  font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 24px;
}
.hero-badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--teal); display: block; }
.hero h1 { font-family: var(--font-display); font-size: 60px; line-height: 1.08; margin-bottom: 20px; letter-spacing: -1px; }
.hero h1 span { color: var(--teal); }
.hero-sub { color: var(--text-dim); font-size: 17px; line-height: 1.65; margin-bottom: 36px; max-width: 440px; font-weight: 300; }
.hero-actions { display: flex; gap: 14px; align-items: center; margin-bottom: 48px; }
.btn-hero { background: var(--teal); color: var(--navy); padding: 14px 32px; border-radius: 10px; font-size: 16px; font-weight: 700; border: none; font-family: var(--font-body); cursor: pointer; }
.btn-demo { background: transparent; border: 1px solid rgba(255,255,255,0.25); color: var(--white); padding: 14px 28px; border-radius: 10px; font-size: 16px; font-family: var(--font-body); cursor: pointer; }
.hero-trust { display: flex; gap: 20px; flex-wrap: wrap; }
.trust-badge {
  display: flex; align-items: center; gap: 8px; background: var(--card-bg);
  border: 1px solid var(--card-border); padding: 10px 16px; border-radius: 10px; font-size: 12px;
}
.trust-badge i { color: var(--teal); font-size: 15px; }

.hero-right { position: relative; }
.stat-bar {
  display: grid; grid-template-columns: repeat(4,1fr); gap: 1px;
  background: rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; margin-bottom: 16px;
}
.stat-cell { background: var(--navy-mid); padding: 16px; text-align: center; }
.stat-num { font-size: 22px; font-weight: 700; color: var(--teal); }
.stat-lbl { font-size: 10px; color: var(--text-dim); letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px; }

.hero-mockup {
  background: var(--navy-mid); border-radius: 20px; border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden; padding: 0;
}
.mockup-topbar {
  background: rgba(0,0,0,0.25); padding: 12px 16px; display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.mockup-dots { display: flex; gap: 5px; }
.mockup-dots span { width: 9px; height: 9px; border-radius: 50%; }
.mockup-dots span:nth-child(1) { background: #ff5f57; }
.mockup-dots span:nth-child(2) { background: #febc2e; }
.mockup-dots span:nth-child(3) { background: #28c840; }
.mockup-title { font-size: 12px; color: var(--text-dim); }
.mockup-body { padding: 20px; }
.visit-card { background: rgba(14,207,176,0.08); border: 1px solid rgba(14,207,176,0.2); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.visit-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.visit-name { font-weight: 600; font-size: 14px; }
.visit-status { background: var(--teal); color: var(--navy); font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
.visit-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); margin-bottom: 6px; }
.visit-row i { color: var(--teal); font-size: 13px; }
.med-row { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; font-size: 12px; }
.med-check { width: 18px; height: 18px; border-radius: 50%; background: var(--teal); display: flex; align-items: center; justify-content: center; }
.med-check i { font-size: 10px; color: var(--navy); }
.ai-bubble {
  background: rgba(14,207,176,0.1); border: 1px solid rgba(14,207,176,0.25);
  border-radius: 10px; padding: 10px 14px; margin-top: 12px;
}
.ai-bubble-label { font-size: 10px; color: var(--teal); font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
.ai-bubble-text { font-size: 12px; color: var(--text-dim); line-height: 1.5; }

/* ── SECTION COMMON ── */
section { padding: 80px 48px; max-width: 1200px; margin: 0 auto; }
.section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--teal); font-weight: 600; margin-bottom: 14px; }
.section-title { font-family: var(--font-display); font-size: 42px; line-height: 1.12; margin-bottom: 16px; letter-spacing: -0.5px; }
.section-sub { color: var(--text-dim); font-size: 16px; line-height: 1.7; max-width: 560px; font-weight: 300; }
.divider { height: 1px; background: rgba(255,255,255,0.06); margin: 0 48px; }

/* ── FEATURES GRID ── */
.features-intro { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: start; margin-bottom: 56px; }
.features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.feat-card {
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius-card); padding: 28px; transition: border-color .25s, background .25s;
}
.feat-card:hover { border-color: rgba(14,207,176,0.4); background: rgba(14,207,176,0.05); }
.feat-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--teal-muted); border: 1px solid rgba(14,207,176,0.25); display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
.feat-icon svg { width: 24px; height: 24px; color: var(--teal); }
.feat-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.feat-card p { font-size: 13px; color: var(--text-dim); line-height: 1.6; }
.feat-new { display: inline-block; background: rgba(14,207,176,0.15); color: var(--teal); font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-bottom: 10px; letter-spacing: 0.3px; }

/* ── HOW IT WORKS ── */
.how-section { background: linear-gradient(180deg, transparent, rgba(14,207,176,0.04), transparent); }
.steps { display: grid; grid-template-columns: repeat(4,1fr); gap: 0; position: relative; margin-top: 56px; }
.steps::before { content: ''; position: absolute; top: 26px; left: 12.5%; right: 12.5%; height: 1px; background: linear-gradient(90deg, var(--teal), rgba(14,207,176,0.2)); }
.step { text-align: center; padding: 0 20px; position: relative; }
.step-num { width: 52px; height: 52px; border-radius: 50%; background: var(--navy-mid); border: 2px solid var(--teal); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--teal); position: relative; z-index: 1; }
.step h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.step p { font-size: 13px; color: var(--text-dim); line-height: 1.55; }

/* ── FOR WHOM ── */
.personas { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-top: 48px; }
.persona-card {
  border-radius: var(--radius-card); padding: 32px;
  border: 1px solid rgba(255,255,255,0.07);
}
.persona-card.carer { background: linear-gradient(135deg, rgba(14,207,176,0.08), rgba(14,207,176,0.02)); border-color: rgba(14,207,176,0.2); }
.persona-card.supervisor { background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02)); border-color: rgba(59,130,246,0.2); }
.persona-card.manager { background: linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.02)); border-color: rgba(168,85,247,0.2); }
.persona-role { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 12px; }
.carer .persona-role { color: var(--teal); }
.supervisor .persona-role { color: #60a5fa; }
.manager .persona-role { color: #c084fc; }
.persona-card h3 { font-size: 20px; font-weight: 600; margin-bottom: 12px; }
.persona-card p { font-size: 13px; color: var(--text-dim); line-height: 1.6; margin-bottom: 20px; }
.persona-list { list-style: none; }
.persona-list li { font-size: 13px; color: var(--text-dim); padding: 5px 0; display: flex; gap: 8px; align-items: flex-start; }
.persona-list li::before { content: '✓'; color: var(--teal); font-weight: 700; flex-shrink: 0; margin-top: 1px; }

/* ── COMPLIANCE ── */
.compliance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
.compliance-badges { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.comp-badge { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; }
.comp-badge i { font-size: 24px; color: var(--teal); margin-bottom: 10px; display: block; }
.comp-badge h4 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.comp-badge p { font-size: 12px; color: var(--text-dim); }

/* ── TESTIMONIALS ── */
.testimonials-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-top: 48px; }
.testi-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-card); padding: 28px; }
.testi-stars { color: var(--teal); font-size: 13px; margin-bottom: 14px; letter-spacing: 2px; }
.testi-card blockquote { font-size: 14px; color: var(--off-white); line-height: 1.65; margin-bottom: 20px; font-style: italic; }
.testi-author { display: flex; align-items: center; gap: 10px; }
.testi-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--teal-muted); border: 1px solid rgba(14,207,176,0.3); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--teal); }
.testi-name { font-size: 13px; font-weight: 600; }
.testi-role { font-size: 11px; color: var(--text-dim); }

/* ── PRICING ── */
.pricing-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-top: 48px; }
.price-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-card); padding: 32px; position: relative; }
.price-card.featured { background: rgba(14,207,176,0.07); border-color: rgba(14,207,176,0.45); }
.price-popular { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--teal); color: var(--navy); font-size: 11px; font-weight: 700; padding: 4px 16px; border-radius: 20px; white-space: nowrap; }
.price-plan { font-size: 13px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
.price-amount { font-family: var(--font-display); font-size: 42px; font-weight: 700; margin-bottom: 6px; }
.price-amount span { font-family: var(--font-body); font-size: 16px; font-weight: 400; color: var(--text-dim); }
.price-desc { font-size: 13px; color: var(--text-dim); margin-bottom: 24px; }
.price-divider { height: 1px; background: rgba(255,255,255,0.08); margin-bottom: 20px; }
.price-features { list-style: none; margin-bottom: 28px; }
.price-features li { font-size: 13px; padding: 6px 0; display: flex; gap: 8px; align-items: center; }
.price-features li i { color: var(--teal); font-size: 15px; }
.price-btn { width: 100%; padding: 13px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--font-body); border: none; }
.price-btn-outline { background: transparent; border: 1px solid rgba(255,255,255,0.2) !important; color: var(--white); }
.price-btn-solid { background: var(--teal); color: var(--navy); }

/* ── CTA ── */
.cta-section { text-align: center; padding: 100px 48px; background: linear-gradient(180deg, transparent, rgba(14,207,176,0.06), transparent); }
.cta-section h2 { font-family: var(--font-display); font-size: 52px; margin-bottom: 16px; }
.cta-section p { color: var(--text-dim); font-size: 17px; margin-bottom: 36px; font-weight: 300; }
.cta-buttons { display: flex; gap: 16px; justify-content: center; }

/* ── FOOTER ── */
.footer { border-top: 1px solid rgba(255,255,255,0.07); padding: 48px; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; max-width: 1200px; margin: 0 auto 40px; }
.footer-brand p { font-size: 13px; color: var(--text-dim); line-height: 1.7; margin-top: 12px; max-width: 260px; }
.footer-col h4 { font-size: 13px; font-weight: 600; margin-bottom: 16px; }
.footer-col a { display: block; font-size: 13px; color: var(--text-dim); text-decoration: none; margin-bottom: 10px; transition: color .2s; cursor: pointer; }
.footer-col a:hover { color: var(--teal); }
.footer-bottom { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.06); }
.footer-bottom p { font-size: 12px; color: var(--text-dim); }

/* responsive */
@media (max-width: 1024px) {
  .hero { grid-template-columns: 1fr; padding: 80px 32px; text-align: center; }
  .hero-sub { margin: 0 auto 36px; }
  .hero-actions { justify-content: center; }
  .hero-trust { justify-content: center; }
  .features-intro { grid-template-columns: 1fr; }
  .compliance-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .nav { padding: 16px 24px; }
  .nav-links { display: none; }
  .features-grid { grid-template-columns: repeat(2, 1fr); }
  .steps { grid-template-columns: repeat(2, 1fr); }
  .steps::before { display: none; }
  .personas { grid-template-columns: 1fr; }
  .testimonials-grid { grid-template-columns: 1fr; }
  .pricing-grid { grid-template-columns: 1fr; max-width: 480px; margin: 48px auto 0; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .hero h1 { font-size: 42px; }
  .section-title { font-size: 32px; }
  .hero { padding: 60px 20px; }
  section, .how-section > div { padding: 60px 20px !important; }
  .divider { margin: 0 20px; }
  .features-grid { grid-template-columns: 1fr; }
  .steps { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
  .cta-section h2 { font-size: 34px; }
  .cta-buttons { flex-direction: column; align-items: center; }
}
</style>

<h2 class="sr-only">CAREi — AI-powered care management platform marketing website</h2>

<div class="site">

  <!-- NAV -->
  <nav class="nav">
    <a href="/" class="nav-logo">
      <img src="/logo.jpg" alt="CAREi" class="nav-logo-icon" />
      <span class="nav-logo-name">CAREi</span>
    </a>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#how-it-works">How it works</a>
      <a href="#compliance">Compliance</a>
      <a href="#pricing">Pricing</a>
    </div>
    <div class="nav-cta">
      <a href="/login" class="btn-ghost">Sign in</a>
      <a href="/login" class="btn-teal">Get started free</a>
    </div>
  </nav>

  <!-- HERO -->
  <div style="max-width:1200px;margin:0 auto;">
    <div class="hero">
      <div>
        <div class="hero-badge">Now with AI Copilot &amp; Real-time Dashboard</div>
        <h1>Care That<br><span>Documents Itself</span></h1>
        <p class="hero-sub">AI-powered care management for frontline carers. Voice notes, digital MAR, instant handovers — all in one place. Built for the NHS, DSPT-compliant from day one.</p>
        <div class="hero-actions">
          <a href="/login" class="btn-hero">Get started free →</a>
          <a href="#" class="btn-demo">Watch demo</a>
        </div>
        <div class="hero-trust">
          <div class="trust-badge"><i class="ti ti-shield-check" aria-hidden="true"></i> GDPR ready</div>
          <div class="trust-badge"><i class="ti ti-building-hospital" aria-hidden="true"></i> NHS-aligned</div>
          <div class="trust-badge"><i class="ti ti-lock" aria-hidden="true"></i> End-to-end encrypted</div>
        </div>
      </div>
      <div class="hero-right">
        <div class="stat-bar" style="margin-bottom:16px;">
          <div class="stat-cell"><div class="stat-num">200+</div><div class="stat-lbl">Care homes</div></div>
          <div class="stat-cell"><div class="stat-num">15K+</div><div class="stat-lbl">Shifts logged</div></div>
          <div class="stat-cell"><div class="stat-num">99.9%</div><div class="stat-lbl">Uptime</div></div>
          <div class="stat-cell"><div class="stat-num">4.9★</div><div class="stat-lbl">App store</div></div>
        </div>
        <div class="hero-mockup">
          <div class="mockup-topbar">
            <div class="mockup-dots"><span></span><span></span><span></span></div>
            <div class="mockup-title">Active visit — Margaret Ellis</div>
            <div style="font-size:11px;color:var(--teal);">● Live</div>
          </div>
          <div class="mockup-body">
            <div class="visit-card">
              <div class="visit-header">
                <div class="visit-name">Margaret Ellis, 84</div>
                <div class="visit-status">In progress</div>
              </div>
              <div class="visit-row"><i class="ti ti-map-pin" aria-hidden="true"></i> 12 Elmwood Close, Bristol BS3 4NR</div>
              <div class="visit-row"><i class="ti ti-clock" aria-hidden="true"></i> 09:15 AM · 45 min visit</div>
              <div class="visit-row"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Penicillin allergy on file — flagged</div>
            </div>
            <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Medications (3 of 4 confirmed)</div>
            <div class="med-row"><span>Amlodipine 5mg</span><div class="med-check"><i class="ti ti-check" aria-hidden="true"></i></div></div>
            <div class="med-row"><span>Lisinopril 10mg</span><div class="med-check"><i class="ti ti-check" aria-hidden="true"></i></div></div>
            <div class="med-row" style="opacity:0.5;"><span>Simvastatin 20mg — pending</span><div style="width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.3);"></div></div>
            <div class="ai-bubble">
              <div class="ai-bubble-label"><i class="ti ti-robot" aria-hidden="true"></i> AI Copilot</div>
              <div class="ai-bubble-text">Margaret\'s care plan flags fluid intake target of 1.5L today. Current logged: 750ml. Recommend prompting during morning tea.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- FEATURES -->
  <section id="features">
    <div class="features-intro">
      <div>
        <div class="section-label">Platform features</div>
        <h2 class="section-title">Everything a carer needs, nothing they don\'t</h2>
      </div>
      <p class="section-sub" style="margin-top:8px;">CAREi v5.0 ships 14 features across 24 screens — designed with frontline carers, validated against CQC requirements, and built to reduce documentation burden by over 70%.</p>
    </div>
    <div class="features-grid">
      <div class="feat-card">
        <div class="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-brain"></use></svg></div>
        <span class="feat-new">New</span>
        <h3>AI Copilot</h3>
        <p>Ask anything about the current client — voice or text. Answers drawn strictly from their care record, with proactive allergy and contraindication alerts.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-microphone"></use></svg></div>
        <span class="feat-new">New</span>
        <h3>Voice-first documentation</h3>
        <p>Narrate observations while you work. Deepgram transcribes in real-time; AI extracts structured data for review. Original audio stored for audit.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-notes"></use></svg></div>
        <h3>ContinuCare+ handover</h3>
        <p>Auto-generates a 3-point briefing at clock-out — observations, tasks, flags. Submitted within 10 seconds, visible to the next carer immediately.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-pill"></use></svg></div>
        <h3>Digital MAR</h3>
        <p>Per-medication confirmation with mandatory skip reasons. CQC-auditable records with carer identity, timestamp, and GPS. Full PDF export.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-shield-lock"></use></svg></div>
        <h3>Lone worker SOS</h3>
        <p>One-tap emergency button on every active visit screen. Sends location to supervisors in under 30 seconds with an immutable incident record.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-activity"></use></svg></div>
        <span class="feat-new">New</span>
        <h3>Passive safety monitoring</h3>
        <p>Always-on GPS heartbeat from clock-in to clock-out. Screen inactivity triggers check-in prompts. Auto-escalation to supervisor and secondary contact.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-heart-rate-monitor"></use></svg></div>
        <h3>Vital signs</h3>
        <p>Entry fields appear only when the care plan requires them. Out-of-range values auto-flag the supervisor in real-time.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-droplet"></use></svg></div>
        <h3>Fluid tracking</h3>
        <p>Persistent one-tap counter on the visit screen. 250ml per tap, configurable. Auto-included in handover — no extra carer action needed.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-volume"></use></svg></div>
        <span class="feat-new">New</span>
        <h3>Audio shift briefing</h3>
        <p>TTS playback of the upcoming visit — plays in the background while the phone is locked, designed for carers travelling between visits.</p>
      </div>
    </div>
  </section>

  <div class="divider"></div>

  <!-- HOW IT WORKS -->
  <section id="how-it-works" class="how-section" style="max-width:100%;padding:80px 48px;">
    <div style="max-width:1200px;margin:0 auto;">
      <div style="text-align:center;max-width:600px;margin:0 auto 0;">
        <div class="section-label">How it works</div>
        <h2 class="section-title">From clock-in to handover in one flow</h2>
      </div>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <h3>Clock in</h3>
          <p>GPS-verified clock-in activates the visit. Audio briefing plays automatically — no manual steps.</p>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <h3>Deliver care</h3>
          <p>Confirm medications, log vitals, track fluids, and capture observations by voice — all while caring.</p>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <h3>AI reviews</h3>
          <p>Copilot surfaces alerts, flags anomalies, and auto-structures all documentation in the background.</p>
        </div>
        <div class="step">
          <div class="step-num">4</div>
          <h3>Handover</h3>
          <p>3-point briefing generated at clock-out. Supervisor notified. Audit trail complete. Zero paperwork.</p>
        </div>
      </div>
    </div>
  </section>

  <div class="divider"></div>

  <!-- FOR WHOM -->
  <section id="for-whom">
    <div class="section-label">Built for every role</div>
    <h2 class="section-title">One platform, every perspective</h2>
    <div class="personas">
      <div class="persona-card carer">
        <div class="persona-role">Frontline carers</div>
        <h3>Less admin, more care</h3>
        <p>CAREi removes the paperwork from caring. Everything you need is on one screen, exactly when you need it.</p>
        <ul class="persona-list">
          <li>Voice notes — no typing during visits</li>
          <li>Medication confirmation in 2 taps</li>
          <li>SOS button always within reach</li>
          <li>Briefing plays on the way to every visit</li>
          <li>Progressive capture — no forms at end of shift</li>
        </ul>
      </div>
      <div class="persona-card supervisor">
        <div class="persona-role">Supervisors</div>
        <h3>Real-time oversight</h3>
        <p>Get push alerts the moment something needs attention — without refreshing a dashboard or chasing carers by phone.</p>
        <ul class="persona-list">
          <li>Push alerts for every flagged visit</li>
          <li>Acknowledge from notification tray</li>
          <li>Out-of-range vitals escalated instantly</li>
          <li>SOS location visible within 30 seconds</li>
          <li>Auto-escalation if unacknowledged at 15 min</li>
        </ul>
      </div>
      <div class="persona-card manager">
        <div class="persona-role">Care managers</div>
        <h3>CQC-ready, always</h3>
        <p>Every visit generates a complete, timestamped audit trail — exportable, searchable, and built for inspection day.</p>
        <ul class="persona-list">
          <li>Full MAR history with PDF export</li>
          <li>Immutable incident records</li>
          <li>DSPT-compliant data handling</li>
          <li>Manager portal for team oversight</li>
          <li>Trend analytics across clients and shifts</li>
        </ul>
      </div>
    </div>
  </section>

  <div class="divider"></div>

  <!-- COMPLIANCE -->
  <section id="compliance">
    <div class="compliance-grid">
      <div>
        <div class="section-label">Compliance &amp; security</div>
        <h2 class="section-title">Built for the NHS. Trusted by CQC.</h2>
        <p class="section-sub">CAREi was designed alongside UK care providers and legal advisors from the ground up — not retrofitted for compliance after the fact.</p>
        <div style="margin-top:28px;display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <i class="ti ti-check" style="color:var(--teal);font-size:18px;margin-top:1px;" aria-hidden="true"></i>
            <div>
              <div style="font-size:14px;font-weight:600;margin-bottom:2px;">Immutable audit trails</div>
              <div style="font-size:13px;color:var(--text-dim);">Every action timestamped, GPS-tagged, and carer-attributed. Cannot be edited or deleted.</div>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <i class="ti ti-check" style="color:var(--teal);font-size:18px;margin-top:1px;" aria-hidden="true"></i>
            <div>
              <div style="font-size:14px;font-weight:600;margin-bottom:2px;">End-to-end encryption</div>
              <div style="font-size:13px;color:var(--text-dim);">All client data encrypted in transit and at rest. UK data residency guaranteed.</div>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <i class="ti ti-check" style="color:var(--teal);font-size:18px;margin-top:1px;" aria-hidden="true"></i>
            <div>
              <div style="font-size:14px;font-weight:600;margin-bottom:2px;">Role-based access control</div>
              <div style="font-size:13px;color:var(--text-dim);">Carers see only their clients. Supervisors see their team. Managers see everything.</div>
            </div>
          </div>
        </div>
      </div>
      <div class="compliance-badges">
        <div class="comp-badge"><i class="ti ti-shield-check" aria-hidden="true"></i><h4>GDPR ready</h4><p>UK GDPR compliant. Data never leaves UK servers.</p></div>
        <div class="comp-badge"><i class="ti ti-building-hospital" aria-hidden="true"></i><h4>DSPT aligned</h4><p>NHS Data Security &amp; Protection Toolkit standards.</p></div>
        <div class="comp-badge"><i class="ti ti-certificate" aria-hidden="true"></i><h4>CQC audit ready</h4><p>Every record built to withstand inspection.</p></div>
        <div class="comp-badge"><i class="ti ti-lock-access" aria-hidden="true"></i><h4>ISO 27001</h4><p>Information security management certified.</p></div>
      </div>
    </div>
  </section>

  <div class="divider"></div>

  <!-- TESTIMONIALS -->
  <section id="testimonials">
    <div style="text-align:center;margin-bottom:0;">
      <div class="section-label">What care homes say</div>
      <h2 class="section-title">Trusted across 200+ care homes</h2>
    </div>
    <div class="testimonials-grid">
      <div class="testi-card">
        <div class="testi-stars">★★★★★</div>
        <blockquote>"Since deploying CAREi, our carers spend 40% less time on documentation. They actually talk to residents now instead of filling forms at the end of a visit."</blockquote>
        <div class="testi-author">
          <div class="testi-avatar">SR</div>
          <div><div class="testi-name">Sarah Redmond</div><div class="testi-role">Care Home Manager · Bristol</div></div>
        </div>
      </div>
      <div class="testi-card">
        <div class="testi-stars">★★★★★</div>
        <blockquote>"The SOS feature alone was worth it. One of our lone workers activated it during a home visit — supervisor had location and was en route in under two minutes."</blockquote>
        <div class="testi-author">
          <div class="testi-avatar">DT</div>
          <div><div class="testi-name">David Thornton</div><div class="testi-role">Operations Director · Midlands</div></div>
        </div>
      </div>
      <div class="testi-card">
        <div class="testi-stars">★★★★★</div>
        <blockquote>"Our last CQC inspection went without a single documentation query. The auditor said our MAR records were the most complete they\'d seen from a provider our size."</blockquote>
        <div class="testi-author">
          <div class="testi-avatar">AM</div>
          <div><div class="testi-name">Amara Mensah</div><div class="testi-role">Registered Manager · London</div></div>
        </div>
      </div>
    </div>
  </section>

  <div class="divider"></div>

  <!-- PRICING -->
  <section id="pricing">
    <div style="text-align:center;max-width:560px;margin:0 auto 0;">
      <div class="section-label">Pricing</div>
      <h2 class="section-title">Simple, per-carer pricing</h2>
      <p class="section-sub" style="margin:0 auto;">No setup fees. No long contracts. Cancel anytime. Every plan includes GDPR-compliant UK hosting.</p>
    </div>
    <div class="pricing-grid">
      <div class="price-card">
        <div class="price-plan">Starter</div>
        <div class="price-amount">£8 <span>/ carer / mo</span></div>
        <div class="price-desc">For small care teams getting started with digital records.</div>
        <div class="price-divider"></div>
        <ul class="price-features">
          <li><i class="ti ti-check" aria-hidden="true"></i> Digital MAR + handover</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> Lone worker SOS</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> Vital signs + fluid tracking</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> Supervisor dashboard</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> UK data hosting</li>
        </ul>
        <a href="/login" class="price-btn price-btn-outline">Start free trial</a>
      </div>
      <div class="price-card featured">
        <div class="price-popular">Most popular</div>
        <div class="price-plan">Professional</div>
        <div class="price-amount">£14 <span>/ carer / mo</span></div>
        <div class="price-desc">For growing providers who need AI documentation and compliance tools.</div>
        <div class="price-divider"></div>
        <ul class="price-features">
          <li><i class="ti ti-check" aria-hidden="true"></i> Everything in Starter</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> AI Copilot</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> Voice-first documentation</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> Audio shift briefing</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> Passive lone worker monitoring</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> CQC audit export</li>
        </ul>
        <a href="/login" class="price-btn price-btn-solid">Start free trial</a>
      </div>
      <div class="price-card">
        <div class="price-plan">Enterprise</div>
        <div class="price-amount">Custom</div>
        <div class="price-desc">For multi-site providers and NHS Integrated Care Boards.</div>
        <div class="price-divider"></div>
        <ul class="price-features">
          <li><i class="ti ti-check" aria-hidden="true"></i> Everything in Professional</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> Dedicated account manager</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> Custom integrations (EMIS, SystmOne)</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> SLA-backed uptime</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> On-site training</li>
          <li><i class="ti ti-check" aria-hidden="true"></i> DSPT support package</li>
        </ul>
        <a href="mailto:sales@careiapp.com" class="price-btn price-btn-outline">Talk to sales</a>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <div id="demo" class="cta-section">
    <h2>Ready to free your carers<br>from paperwork?</h2>
    <p>Join 200+ care homes already running CAREi. Set up in under a day, trained in under an hour.</p>
    <div class="cta-buttons">
      <a href="/login" class="btn-hero" style="font-size:15px;padding:16px 36px;">Start 30-day free trial →</a>
      <a href="#" class="btn-demo" style="font-size:15px;padding:16px 28px;">Book a demo</a>
    </div>
    <div style="margin-top:20px;font-size:13px;color:var(--text-dim);">No credit card required · UK data hosting · Cancel anytime</div>
  </div>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="nav-logo">
          <img src="/logo.jpg" alt="CAREi" class="nav-logo-icon" />
          <span class="nav-logo-name">CAREi</span>
        </div>
        <p>AI-powered care management for frontline carers. Built in the UK, trusted across 200+ care homes.</p>
      </div>
      <div class="footer-col">
        <h4>Product</h4>
        <a href="#features">Features</a>
        <a href="#how-it-works">How it works</a>
        <a href="#pricing">Pricing</a>
        <a href="/manager/login">Manager portal</a>
        <a href="#">Changelog</a>
      </div>
      <div class="footer-col">
        <h4>Compliance</h4>
        <a href="#compliance">GDPR &amp; data</a>
        <a href="#compliance">DSPT alignment</a>
        <a href="#compliance">CQC readiness</a>
        <a href="#compliance">Security</a>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <a href="#">About</a>
        <a href="#">Blog</a>
        <a href="#">Careers</a>
        <a href="#">Contact</a>
        <a href="#">Privacy policy</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 CAREi. All rights reserved. Registered in England &amp; Wales.</p>
      <p style="color:var(--teal);">Live across 200+ care homes ●</p>
    </div>
  </footer>

</div>
`

export default function HomePage() {
  const [, setLocation] = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)

    const logos = document.querySelectorAll<HTMLAnchorElement>('a.nav-logo')
    const handleClick = (e: Event) => {
      e.preventDefault()
      setLocation('/')
      window.scrollTo(0, 0)
    }
    logos.forEach((logo) => logo.addEventListener('click', handleClick))
    return () => logos.forEach((logo) => logo.removeEventListener('click', handleClick))
  }, [setLocation])

  return (
    <div
      className="min-h-screen"
      style={{ background: '#0d1b2e' }}
      dangerouslySetInnerHTML={{ __html: siteHtml }}
    />
  )
}
