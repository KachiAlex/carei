import { useEffect } from 'react'

const APP_URL = 'https://app.careiapp.com'

export default function LandingPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#0d1b2e' }}>
      <style>{`
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

/* NAV */
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 20px) 48px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
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
.nav-hamburger { display: none; cursor: pointer; font-size: 22px; color: var(--white); padding: 6px; }
.mobile-cta { display: none; }
.btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--white); padding: 9px 20px; border-radius: 8px; font-size: 14px; font-family: var(--font-body); cursor: pointer; transition: border-color .2s, color .2s; }
.btn-ghost:hover { border-color: var(--teal); color: var(--teal); }
.btn-teal { background: var(--teal); color: var(--navy); padding: 9px 22px; border-radius: 8px; font-size: 14px; font-weight: 600; border: none; font-family: var(--font-body); cursor: pointer; transition: background .2s; }
.btn-teal:hover { background: var(--teal-dark); }

a.btn-hero, a.btn-demo, a.btn-teal, a.btn-ghost, a.price-btn { text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }

/* HERO */
.hero {
  --hero-overlay: radial-gradient(circle at 70% 25%, rgba(14,207,176,0.22) 0%, transparent 45%),
    linear-gradient(115deg, rgba(13,27,46,0.95) 0%, rgba(13,27,46,0.75) 50%, rgba(14,207,176,0.25) 100%);
  --hero-image: url('/careiapp-cover.png');
  padding: 100px 48px 80px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center;
  max-width: 1200px; margin: 0 auto;
  position: relative;
  min-height: 600px;
  background-image: var(--hero-overlay), var(--hero-image);
  background-size: cover, cover, cover;
  background-position: center, center, 65% center;
  background-repeat: no-repeat;
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
.trust-badge i, .trust-badge .ti-svg { color: var(--teal); font-size: 15px; }

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
.visit-row i, .visit-row .ti-svg { color: var(--teal); font-size: 13px; }
.med-row { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; font-size: 12px; }
.med-check { width: 18px; height: 18px; border-radius: 50%; background: var(--teal); display: flex; align-items: center; justify-content: center; }
.med-check i, .med-check .ti-svg { font-size: 10px; color: var(--navy); }
.ai-bubble {
  background: rgba(14,207,176,0.1); border: 1px solid rgba(14,207,176,0.25);
  border-radius: 10px; padding: 10px 14px; margin-top: 12px;
}
.ai-bubble-label { font-size: 10px; color: var(--teal); font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
.ai-bubble-text { font-size: 12px; color: var(--text-dim); line-height: 1.5; }

/* SECTION COMMON */
section { padding: 80px 48px; max-width: 1200px; margin: 0 auto; }
.section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--teal); font-weight: 600; margin-bottom: 14px; }
.section-title { font-family: var(--font-display); font-size: 42px; line-height: 1.12; margin-bottom: 16px; letter-spacing: -0.5px; }
.section-sub { color: var(--text-dim); font-size: 16px; line-height: 1.7; max-width: 560px; font-weight: 300; }
.section-alt { background: var(--navy-mid); border-radius: 24px; margin: 24px auto; }
.divider { height: 1px; background: rgba(255,255,255,0.06); margin: 0 48px; }

/* FEATURES GRID */
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

/* HOW IT WORKS */
.how-section { background: linear-gradient(180deg, transparent, rgba(14,207,176,0.04), transparent); }
.steps { display: grid; grid-template-columns: repeat(4,1fr); gap: 0; position: relative; margin-top: 56px; }
.steps::before { content: ''; position: absolute; top: 26px; left: 12.5%; right: 12.5%; height: 1px; background: linear-gradient(90deg, var(--teal), rgba(14,207,176,0.2)); }
.step { text-align: center; padding: 0 20px; position: relative; }
.step-num { width: 52px; height: 52px; border-radius: 50%; background: var(--navy-mid); border: 2px solid var(--teal); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--teal); position: relative; z-index: 1; }
.step h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.step p { font-size: 13px; color: var(--text-dim); line-height: 1.55; }

/* FOR WHOM */
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

/* COMPLIANCE */
.compliance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
.compliance-badges { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.comp-badge { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; }
.comp-badge i, .comp-badge .ti-svg { font-size: 24px; color: var(--teal); margin-bottom: 10px; display: block; }
.comp-badge h4 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.comp-badge p { font-size: 12px; color: var(--text-dim); }

/* TESTIMONIALS */
.testimonials-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-top: 48px; }
.testi-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-card); padding: 28px; }
.testi-stars { color: var(--teal); font-size: 13px; margin-bottom: 14px; letter-spacing: 2px; }
.testi-card blockquote { font-size: 14px; color: var(--off-white); line-height: 1.65; margin-bottom: 20px; font-style: italic; }
.testi-author { display: flex; align-items: center; gap: 10px; }
.testi-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--teal-muted); border: 1px solid rgba(14,207,176,0.3); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--teal); }
.testi-name { font-size: 13px; font-weight: 600; }
.testi-role { font-size: 11px; color: var(--text-dim); }

/* CTA */
.cta-section { text-align: center; padding: 100px 48px; background: linear-gradient(180deg, transparent, rgba(14,207,176,0.06), transparent); }
.cta-section h2 { font-family: var(--font-display); font-size: 52px; margin-bottom: 16px; }
.cta-section p { color: var(--text-dim); font-size: 17px; margin-bottom: 36px; font-weight: 300; }
.cta-buttons { display: flex; gap: 16px; justify-content: center; }

/* FOOTER */
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
  .hero {
    --hero-overlay: radial-gradient(circle at 60% 15%, rgba(14,207,176,0.18) 0%, transparent 45%),
      linear-gradient(180deg, rgba(13,27,46,0.96) 0%, rgba(13,27,46,0.88) 40%, rgba(13,27,46,0.65) 100%);
    grid-template-columns: 1fr; padding: 80px 32px; text-align: center;
    background-position: center, center, 55% center;
  }
  .hero-sub { margin: 0 auto 36px; }
  .hero-actions { justify-content: center; }
  .hero-trust { justify-content: center; }
  .features-intro { grid-template-columns: 1fr; }
  .compliance-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .nav { padding: calc(env(safe-area-inset-top) + 16px) 24px 16px; }
  .nav-cta { display: none; }
  .nav-hamburger { display: block; }
  .nav-links { display: none; }
  #nav-toggle:checked ~ .nav-links {
    display: flex; flex-direction: column;
    position: absolute; top: 100%; left: 0; right: 0;
    background: rgba(13,27,46,0.98); backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255,255,255,0.08);
    padding: 24px 48px; gap: 20px;
    box-shadow: 0 24px 40px rgba(0,0,0,0.25);
  }
  .nav-links a { font-size: 16px; }
  .mobile-cta { display: flex; gap: 12px; margin-top: 8px; }
  .features-grid { grid-template-columns: repeat(2, 1fr); }
  .steps { grid-template-columns: repeat(2, 1fr); }
  .steps::before { display: none; }
  .personas { grid-template-columns: 1fr; }
  .testimonials-grid { grid-template-columns: 1fr; }
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

.ti-svg { width: 1em; height: 1em; display: inline-block; vertical-align: middle; color: var(--teal); }
`}</style>

      <div className="site">
        {/* NAV */}
        <nav className="nav">
          <a href="/" className="nav-logo">
            <img src="/logo.jpg" alt="CAREi" className="nav-logo-icon" />
            <span className="nav-logo-name">CAREi</span>
          </a>
          <input type="checkbox" id="nav-toggle" hidden />
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#compliance">Compliance</a>
            <div className="mobile-cta">
              <a href={`${APP_URL}/login`} className="btn-ghost">Sign in</a>
              <a href={`${APP_URL}/login`} className="btn-teal">Get started</a>
            </div>
          </div>
          <div className="nav-cta">
            <a href={`${APP_URL}/login`} className="btn-ghost">Sign in</a>
            <a href={`${APP_URL}/login`} className="btn-teal">Get started</a>
          </div>
          <label htmlFor="nav-toggle" className="nav-hamburger" aria-label="Toggle navigation">☰</label>
        </nav>

        {/* HERO */}
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="hero">
            <div>
              <div className="hero-badge">Now with AI Copilot &amp; Real-time Dashboard</div>
              <h1>Care That<br /><span>Documents Itself</span></h1>
              <p className="hero-sub">AI-powered care management for frontline carers. Voice notes, digital MAR, instant handovers — all in one place. Built for the NHS, DSPT-compliant from day one.</p>
              <div className="hero-actions">
                <a href={`${APP_URL}/login`} className="btn-hero">Get started →</a>
                <a href="#demo" className="btn-demo">Watch demo</a>
              </div>
              <div className="hero-trust">
                <div className="trust-badge"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-shield-check"></use></svg> GDPR ready</div>
                <div className="trust-badge"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-building-hospital"></use></svg> NHS-aligned</div>
                <div className="trust-badge"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-lock"></use></svg> End-to-end encrypted</div>
              </div>
            </div>
            <div className="hero-right">
              <div className="hero-mockup">
                <div className="mockup-topbar">
                  <div className="mockup-dots"><span></span><span></span><span></span></div>
                  <div className="mockup-title">Active visit — Margaret Ellis</div>
                  <div style={{ fontSize: '11px', color: 'var(--teal)' }}>● Live</div>
                </div>
                <div className="mockup-body">
                  <div className="visit-card">
                    <div className="visit-header">
                      <div className="visit-name">Margaret Ellis, 84</div>
                      <div className="visit-status">In progress</div>
                    </div>
                    <div className="visit-row"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-map-pin"></use></svg> 12 Elmwood Close, Bristol BS3 4NR</div>
                    <div className="visit-row"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-clock"></use></svg> Visit in progress</div>
                    <div className="visit-row"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-alert-triangle"></use></svg> Penicillin allergy on file — flagged</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Medications (3 of 4 confirmed)</div>
                  <div className="med-row"><span>Amlodipine 5mg</span><div className="med-check"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-check"></use></svg></div></div>
                  <div className="med-row"><span>Lisinopril 10mg</span><div className="med-check"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-check"></use></svg></div></div>
                  <div className="med-row" style={{ opacity: 0.5 }}><span>Simvastatin 20mg — pending</span><div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)' }}></div></div>
                  <div className="ai-bubble">
                    <div className="ai-bubble-label"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-robot"></use></svg> AI Copilot</div>
                    <div className="ai-bubble-text">Margaret's care plan flags a fluid intake target today. Check the latest log and prompt during her next drink.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="divider"></div>

        {/* FEATURES */}
        <section id="features">
          <div className="features-intro">
            <div>
              <div className="section-label">Platform features</div>
              <h2 className="section-title">Everything a carer needs, nothing they don't</h2>
            </div>
            <p className="section-sub" style={{ marginTop: '8px' }}>Designed with frontline carers, validated against CQC requirements, and built to reduce documentation burden.</p>
          </div>
          <div className="features-grid">
            <div className="feat-card">
              <div className="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-brain"></use></svg></div>
              <span className="feat-new">New</span>
              <h3>AI Copilot</h3>
              <p>Ask anything about the current client — voice or text. Answers drawn strictly from their care record, with proactive allergy and contraindication alerts.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-microphone"></use></svg></div>
              <span className="feat-new">New</span>
              <h3>Voice-first documentation</h3>
              <p>Narrate observations while you work. Deepgram transcribes in real-time; AI extracts structured data for review. Original audio stored for audit.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-notes"></use></svg></div>
              <h3>ContinuCare+ handover</h3>
              <p>Auto-generates a 3-point briefing at clock-out — observations, tasks, flags. Submitted within 10 seconds, visible to the next carer immediately.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-pill"></use></svg></div>
              <h3>Digital MAR</h3>
              <p>Per-medication confirmation with mandatory skip reasons. CQC-auditable records with carer identity, timestamp, and GPS. Full PDF export.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-shield-lock"></use></svg></div>
              <h3>Lone worker SOS</h3>
              <p>One-tap emergency button on every active visit screen. Sends location to supervisors in under 30 seconds with an immutable incident record.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-activity"></use></svg></div>
              <span className="feat-new">New</span>
              <h3>Passive safety monitoring</h3>
              <p>Always-on GPS heartbeat from clock-in to clock-out. Screen inactivity triggers check-in prompts. Auto-escalation to supervisor and secondary contact.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-heart-rate-monitor"></use></svg></div>
              <h3>Vital signs</h3>
              <p>Entry fields appear only when the care plan requires them. Out-of-range values auto-flag the supervisor in real-time.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-droplet"></use></svg></div>
              <h3>Fluid tracking</h3>
              <p>Persistent one-tap counter on the visit screen. 250ml per tap, configurable. Auto-included in handover — no extra carer action needed.</p>
            </div>
            <div className="feat-card">
              <div className="feat-icon"><svg width="24" height="24" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-volume"></use></svg></div>
              <span className="feat-new">New</span>
              <h3>Audio shift briefing</h3>
              <p>TTS playback of the upcoming visit — plays in the background while the phone is locked, designed for carers travelling between visits.</p>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="how-section" style={{ maxWidth: '100%', padding: '80px 48px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
              <div className="section-label">How it works</div>
              <h2 className="section-title">From clock-in to handover in one flow</h2>
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <h3>Clock in</h3>
                <p>GPS-verified clock-in activates the visit. Audio briefing plays automatically — no manual steps.</p>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <h3>Deliver care</h3>
                <p>Confirm medications, log vitals, track fluids, and capture observations by voice — all while caring.</p>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <h3>AI reviews</h3>
                <p>Copilot surfaces alerts, flags anomalies, and auto-structures all documentation in the background.</p>
              </div>
              <div className="step">
                <div className="step-num">4</div>
                <h3>Handover</h3>
                <p>3-point briefing generated at clock-out. Supervisor notified. Audit trail complete. Zero paperwork.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* FOR WHOM */}
        <section id="for-whom" className="section-alt">
          <div className="section-label">Built for every role</div>
          <h2 className="section-title">One platform, every perspective</h2>
          <div className="personas">
            <div className="persona-card carer">
              <div className="persona-role">Frontline carers</div>
              <h3>Less admin, more care</h3>
              <p>CAREi removes the paperwork from caring. Everything you need is on one screen, exactly when you need it.</p>
              <ul className="persona-list">
                <li>Voice notes — no typing during visits</li>
                <li>Medication confirmation in 2 taps</li>
                <li>SOS button always within reach</li>
                <li>Briefing plays on the way to every visit</li>
                <li>Progressive capture — no forms at end of shift</li>
              </ul>
            </div>
            <div className="persona-card supervisor">
              <div className="persona-role">Supervisors</div>
              <h3>Real-time oversight</h3>
              <p>Get push alerts the moment something needs attention — without refreshing a dashboard or chasing carers by phone.</p>
              <ul className="persona-list">
                <li>Push alerts for every flagged visit</li>
                <li>Acknowledge from notification tray</li>
                <li>Out-of-range vitals escalated instantly</li>
                <li>SOS location visible within 30 seconds</li>
                <li>Auto-escalation if unacknowledged at 15 min</li>
              </ul>
            </div>
            <div className="persona-card manager">
              <div className="persona-role">Care managers</div>
              <h3>CQC-ready, always</h3>
              <p>Every visit generates a complete, timestamped audit trail — exportable, searchable, and built for inspection day.</p>
              <ul className="persona-list">
                <li>Full MAR history with PDF export</li>
                <li>Immutable incident records</li>
                <li>DSPT-compliant data handling</li>
                <li>Manager portal for team oversight</li>
                <li>Trend analytics across clients and shifts</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* COMPLIANCE */}
        <section id="compliance">
          <div className="compliance-grid">
            <div>
              <div className="section-label">Compliance &amp; security</div>
              <h2 className="section-title">Built for the NHS. Trusted by CQC.</h2>
              <p className="section-sub">CAREi was designed alongside UK care providers and legal advisors from the ground up — not retrofitted for compliance after the fact.</p>
              <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false" style={{ color: 'var(--teal)', fontSize: '18px', marginTop: '1px' }}><use href="/tabler-sprite.svg#tabler-check"></use></svg>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>Immutable audit trails</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Every action timestamped, GPS-tagged, and carer-attributed. Cannot be edited or deleted.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false" style={{ color: 'var(--teal)', fontSize: '18px', marginTop: '1px' }}><use href="/tabler-sprite.svg#tabler-check"></use></svg>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>End-to-end encryption</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>All client data encrypted in transit and at rest. UK data residency guaranteed.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false" style={{ color: 'var(--teal)', fontSize: '18px', marginTop: '1px' }}><use href="/tabler-sprite.svg#tabler-check"></use></svg>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>Role-based access control</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Carers see only their clients. Supervisors see their team. Managers see everything.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="compliance-badges">
              <div className="comp-badge"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-shield-check"></use></svg><h4>GDPR ready</h4><p>UK GDPR compliant. Data never leaves UK servers.</p></div>
              <div className="comp-badge"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-building-hospital"></use></svg><h4>DSPT aligned</h4><p>NHS Data Security &amp; Protection Toolkit standards.</p></div>
              <div className="comp-badge"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-certificate"></use></svg><h4>CQC audit ready</h4><p>Every record built to withstand inspection.</p></div>
              <div className="comp-badge"><svg className="ti-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><use href="/tabler-sprite.svg#tabler-lock-access"></use></svg><h4>ISO 27001</h4><p>Information security management certified.</p></div>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* TESTIMONIALS */}
        <section id="testimonials" className="section-alt">
          <div style={{ textAlign: 'center', marginBottom: 0 }}>
            <div className="section-label">What care homes say</div>
            <h2 className="section-title">Trusted by care providers across the UK</h2>
          </div>
          <div className="testimonials-grid">
            <div className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <blockquote>"Since deploying CAREi, our carers spend less time on documentation. They actually talk to residents now instead of filling forms at the end of a visit."</blockquote>
              <div className="testi-author">
                <div className="testi-avatar">SR</div>
                <div><div className="testi-name">Sarah Redmond</div><div className="testi-role">Care Home Manager · Bristol</div></div>
              </div>
            </div>
            <div className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <blockquote>"The SOS feature alone was worth it. One of our lone workers activated it during a home visit — supervisor had location and was en route in under two minutes."</blockquote>
              <div className="testi-author">
                <div className="testi-avatar">DT</div>
                <div><div className="testi-name">David Thornton</div><div className="testi-role">Operations Director · Midlands</div></div>
              </div>
            </div>
            <div className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <blockquote>"Our last CQC inspection went without a single documentation query. The auditor said our MAR records were the most complete they'd seen from a provider our size."</blockquote>
              <div className="testi-author">
                <div className="testi-avatar">AM</div>
                <div><div className="testi-name">Amara Mensah</div><div className="testi-role">Registered Manager · London</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div id="demo" className="cta-section">
          <h2>Ready to reduce paperwork for your carers?</h2>
          <p>Find out how CAREi can fit your team's workflow. Book a demo or start today.</p>
          <div className="cta-buttons">
            <a href={`${APP_URL}/login`} className="btn-hero" style={{ fontSize: '15px', padding: '16px 36px' }}>Get started →</a>
            <a href="mailto:sales@careiapp.com" className="btn-demo" style={{ fontSize: '15px', padding: '16px 28px' }}>Book a demo</a>
          </div>
          <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--text-dim)' }}>UK data hosting</div>
        </div>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="nav-logo">
                <img src="/logo.jpg" alt="CAREi" className="nav-logo-icon" />
                <span className="nav-logo-name">CAREi</span>
              </div>
              <p>AI-powered care management for frontline carers. Built in the UK for care teams.</p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href={`${APP_URL}/manager/login`}>Manager portal</a>
              <a href="#">Changelog</a>
            </div>
            <div className="footer-col">
              <h4>Compliance</h4>
              <a href="#compliance">GDPR &amp; data</a>
              <a href="#compliance">DSPT alignment</a>
              <a href="#compliance">CQC readiness</a>
              <a href="#compliance">Security</a>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
              <a href="#">Privacy policy</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 CAREi. All rights reserved. Registered in England &amp; Wales.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
