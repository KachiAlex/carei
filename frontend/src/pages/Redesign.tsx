import { useState, useEffect, useRef } from "react";
import { COLORS, type ScheduleClient } from "@/lib/mockData";

// ─── Home Screen ─────────────────────────────────────────────────────────────

const TRUST_BADGES = [
  {
    label: "GDPR", sub: "Compliant",
    svg: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L4 5v5c0 3.5 2.5 6.8 6 7.7 3.5-.9 6-4.2 6-7.7V5L10 2z" stroke="#4FD1C5" strokeWidth="1.5" fill="none"/><path d="M7 10l2 2 4-4" stroke="#4FD1C5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },
  {
    label: "Secure", sub: "Care Records",
    svg: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="4" y="9" width="12" height="9" rx="2" stroke="#4FD1C5" strokeWidth="1.5"/><path d="M7 9V6a3 3 0 016 0v3" stroke="#4FD1C5" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="13.5" r="1.2" fill="#4FD1C5"/></svg>
  },
  {
    label: "AI-Assisted", sub: "Care",
    svg: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3l1.5 3.5L15 7.5l-2.5 2.5.5 3.5L10 12l-3 1.5.5-3.5L5 7.5l3.5-.5L10 3z" stroke="#4FD1C5" strokeWidth="1.3" fill="none"/><circle cx="10" cy="10" r="1" fill="#4FD1C5"/></svg>
  },
];

const HOME_FEATURES = [
  {
    label: "Smart\nHandover",
    svg: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="7" width="20" height="14" rx="3" stroke="#38B2AC" strokeWidth="1.5"/><path d="M9 14h10M9 11h6M9 17h4" stroke="#38B2AC" strokeWidth="1.5" strokeLinecap="round"/><path d="M20 11l3 3-3 3" stroke="#38B2AC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },
  {
    label: "Medication\nConfirmation",
    svg: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="8" y="4" width="12" height="20" rx="3" stroke="#38B2AC" strokeWidth="1.5"/><path d="M8 13h12" stroke="#38B2AC" strokeWidth="1.5"/><path d="M12 8.5h4M11 17.5l2 2 4-4" stroke="#38B2AC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },
  {
    label: "Voice\nDocumentation",
    svg: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="10" y="4" width="8" height="13" rx="4" stroke="#38B2AC" strokeWidth="1.5"/><path d="M6 15c0 4.4 3.6 8 8 8s8-3.6 8-8" stroke="#38B2AC" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 23v3" stroke="#38B2AC" strokeWidth="1.5" strokeLinecap="round"/></svg>
  },
  {
    label: "Lone Worker\nSafety",
    svg: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 3l2 6h6l-5 4 2 6-5-3.5L9 19l2-6-5-4h6L14 3z" stroke="#38B2AC" strokeWidth="1.4" fill="none" strokeLinejoin="round"/><circle cx="14" cy="13" r="2" fill="#38B2AC"/></svg>
  },
];

export function HomeScreen({ onStartShift, onWatchDemo, onProfile }: {
  onStartShift: () => void;
  onWatchDemo: () => void;
  onSOS: () => void;
  onAssistant: () => void;
  onProfile: () => void;
  onRota: () => void;
}) {
  return (
    <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0a1628", fontFamily: "DM Sans, sans-serif" }}>

      {/* ══ DARK HERO ══ */}
      <div style={{ position: "relative", flex: "0 0 auto" }}>

        {/* Full-width hero photo */}
        <div style={{ position: "relative", width: "100%", height: "min(70vh, 560px)", overflow: "hidden" }}>
          <img
            src="/hero-carer.png"
            alt="Carer with patient"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%", display: "block" }}
          />
          {/* Dark overlay — strong at top and bottom, lighter in middle */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,22,40,0.75) 0%, rgba(10,22,40,0.15) 45%, rgba(10,22,40,0.85) 85%, #0a1628 100%)" }} />
          {/* Teal wave lines decoration */}
          <svg style={{ position: "absolute", top: "30%", right: 0, width: "55%", height: "50%", opacity: 0.35 }} viewBox="0 0 200 150" fill="none" preserveAspectRatio="none">
            <path d="M200 30 Q140 10 80 40 Q20 70 0 50" stroke="#4FD1C5" strokeWidth="1.5" fill="none"/>
            <path d="M200 60 Q140 40 80 70 Q20 100 0 80" stroke="#4FD1C5" strokeWidth="1" fill="none"/>
            <path d="M200 90 Q140 70 80 100 Q20 130 0 110" stroke="#4FD1C5" strokeWidth="0.8" fill="none"/>
            {Array.from({length: 5}).map((_, r) => Array.from({length: 4}).map((_, c) => (
              <circle key={`${r}-${c}`} cx={c * 45 + 15} cy={r * 30 + 10} r="2" fill="#4FD1C5"/>
            )))}
          </svg>

          {/* Top nav — sits over the photo */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 24px", zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: COLORS.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3C8 3 5 6 5 10c0 2 .8 3.8 2 5.1L12 21l5-5.9C18.2 13.8 19 12 19 10c0-4-3-7-7-7z" stroke="#0a1628" strokeWidth="1.8" fill="none"/>
                  <path d="M12 7v3.5l2 2" stroke="#0a1628" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 24, letterSpacing: 0.2 }}>
                CARE<span style={{ color: COLORS.teal }}>i</span>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, cursor: "pointer", padding: 4 }} onClick={onProfile}>
              {[0,1,2].map(i => <div key={i} style={{ width: 26, height: 2.5, background: "#fff", borderRadius: 2 }} />)}
            </div>
          </div>

          {/* Headline — bottom-center of photo */}
          <div style={{ position: "absolute", bottom: 32, left: 24, right: 24, zIndex: 10, textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, letterSpacing: -0.5 }}>
              Care That<br />
              Documents <span style={{ color: COLORS.teal, fontStyle: "italic" }}>Itself</span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
              AI-powered care management for frontline carers.
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div style={{ padding: "24px 24px 0", display: "flex", flexDirection: "column", gap: 14, background: "#0a1628" }}>
          <button onClick={onStartShift} style={{
            width: "100%", padding: "18px 0", borderRadius: 999, border: "none",
            background: COLORS.teal, color: "#0a1628", fontWeight: 800, fontSize: 18,
            fontFamily: "DM Sans, sans-serif", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
            boxShadow: "0 8px 36px rgba(79,209,197,0.5)",
          }}>
            Start Shift
            <span style={{ fontSize: 22, fontWeight: 400 }}>→</span>
          </button>
          <button onClick={onWatchDemo} style={{
            width: "100%", padding: "17px 0", borderRadius: 999,
            border: "1.5px solid rgba(255,255,255,0.3)", background: "transparent",
            color: "#fff", fontWeight: 600, fontSize: 18,
            fontFamily: "DM Sans, sans-serif", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
          }}>
            <span style={{ fontSize: 20 }}>⬇</span>
            Download App
          </button>
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "20px 16px 24px", background: "#0a1628", borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 20 }}>
          {TRUST_BADGES.map((b) => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "1.5px solid rgba(79,209,197,0.3)", background: "rgba(79,209,197,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {b.svg}
              </div>
              <div style={{ lineHeight: 1.35 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{b.label}</div>
                <div style={{ color: "#8fa8c8", fontSize: 12 }}>{b.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ WHITE FEATURES SECTION ══ */}
      <div style={{ background: "#fff", flex: 1 }}>
        <div style={{ padding: "28px 24px 0" }}>
          <p style={{ margin: "0 0 22px", color: "#0f2040", fontWeight: 700, fontSize: 18, textAlign: "center", letterSpacing: -0.2 }}>
            Powerful features for modern care
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {HOME_FEATURES.map((f) => (
              <div key={f.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: "#edfafa", border: "1px solid #b2e8e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {f.svg}
                </div>
                <span style={{ color: "#0f2040", fontSize: 12, fontWeight: 600, textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.4 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer tagline */}
        <div style={{ padding: "22px 24px 36px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="#38B2AC" strokeWidth="1.5"/><path d="M6.5 10.5l2.5 2.5 4.5-5" stroke="#38B2AC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ color: "#38B2AC", fontWeight: 600, fontSize: 15 }}>Trusted by care agencies across the UK</span>
        </div>
      </div>
    </div>
  );
}

// ─── Login Screen ────────────────────────────────────────────────────────────

export function LoginScreen({ onSignIn, onBack }: { onSignIn: (email: string, password: string) => Promise<void>; onBack?: () => void }) {
  const [email, setEmail] = useState("demo@carei.app");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSignIn(email, password);
    } catch (e: any) {
      setError(e.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #0a1e3d 0%, #0d2550 60%, #0a1e3d 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", fontFamily: "DM Sans, sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Teal wave decoration bottom */}
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", opacity: 0.15 }} viewBox="0 0 390 120" fill="none" preserveAspectRatio="none">
        <path d="M0 60 Q97 20 195 60 Q292 100 390 60 L390 120 L0 120Z" fill="#4FD1C5"/>
        <path d="M0 80 Q97 40 195 80 Q292 120 390 80 L390 120 L0 120Z" fill="#4FD1C5" opacity="0.5"/>
      </svg>

      {/* Back button */}
      {onBack && (
        <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
        </div>
      )}

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #4FD1C5, #38B2AC)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <path d="M15 6C10 6 6 10 6 15c0 2.8 1.1 5.3 3 7.1L15 28l6-5.9C22.9 20.3 24 17.8 24 15c0-5-4-9-9-9z" stroke="#0a1e3d" strokeWidth="2" fill="none"/>
            <path d="M11 15h8M15 11v8" stroke="#0a1e3d" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 28, letterSpacing: 0.5 }}>
          CARE<span style={{ color: COLORS.teal }}>i</span>
        </span>
      </div>

      {/* Welcome text */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h2 style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 24 }}>Welcome back 👋</h2>
        <p style={{ margin: "8px 0 0", color: "#8fa8c8", fontSize: 15 }}>Secure access to today's care schedule</p>
      </div>

      {/* White card */}
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 28, padding: "28px 24px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ color: "#0f2040", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Sign in</div>
        <div style={{ color: COLORS.g4, fontSize: 14, marginBottom: 20 }}>Enter your credentials to continue</div>

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#475569", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Email</div>
          <input
            type="email" value={email} required
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@carei.app"
            style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#0f2040", fontSize: 15, outline: "none", fontFamily: "DM Sans, sans-serif", fontWeight: 500, boxSizing: "border-box" }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: "#475569", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Password</div>
          <input
            type="password" value={password} required
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#0f2040", fontSize: 15, outline: "none", fontFamily: "DM Sans, sans-serif", fontWeight: 500, boxSizing: "border-box" }}
          />
        </div>

        {error && (
          <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "16px 0", borderRadius: 999, border: "none", background: loading ? "#cbd5e1" : COLORS.teal, color: "#fff", fontWeight: 700, fontSize: 17, fontFamily: "DM Sans, sans-serif", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: loading ? "none" : "0 6px 20px rgba(79,209,197,0.4)", marginBottom: 14 }}>
          {loading ? "Signing in…" : "Sign In"}
          {!loading && <span style={{ fontSize: 18 }}>→</span>}
        </button>

        <div style={{ textAlign: "center", color: COLORS.g4, fontSize: 12 }}>
          Demo: <span style={{ color: COLORS.teal, fontWeight: 600, cursor: "pointer" }} onClick={() => { setEmail("demo@carei.app"); setPassword("password123"); }}>demo@carei.app / password123</span>
        </div>
      </form>

      {/* Encrypted footer */}
      <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 8, color: "#8fa8c8", fontSize: 13 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L3 4v4c0 3 2 5.5 5 6.3 3-.8 5-3.3 5-6.3V4L8 1.5z" stroke="#8fa8c8" strokeWidth="1.3" fill="none"/></svg>
        Your data is encrypted and secure
      </div>
    </div>
  );
}

// ─── Dashboard Screen ────────────────────────────────────────────────────────

const WAVEFORM_HEIGHTS = [8,14,20,12,18,24,10,16,22,8,14,18,24,12,20,10,16,22,14,18];

export function DashboardScreen({
  visitStatuses, onSelectClient, onOperations, onRota, onAssistant, onSOS, onProfile, clients, userName, loading,
}: {
  visitStatuses: Record<string, string>; onSelectClient: (id: string) => void;
  onOperations: () => void; onRota: () => void; onAssistant: () => void;
  onSOS: () => void; onProfile: () => void; clients: ScheduleClient[];
  userName?: string; loading?: boolean;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const doneCount = Object.values(visitStatuses).filter((s) => s === "completed").length;
  const totalVisits = clients.length;
  const progress = Math.round((doneCount / Math.max(totalVisits, 1)) * 100);
  const circumference = 2 * Math.PI * 28;
  const nextClient = clients.find((c) => visitStatuses[c.id] !== "completed") || clients[0];

  const card: React.CSSProperties = { background: "#fff", borderRadius: 20, padding: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#f1f5f9", fontFamily: "DM Sans, sans-serif" }}>

      {/* ── Top nav bar ── */}
      <div style={{ background: "#0a1e3d", padding: "18px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ cursor: "pointer" }} onClick={onOperations}>
          <div style={{ width: 22, height: 2, background: "#fff", borderRadius: 2, marginBottom: 5 }} />
          <div style={{ width: 22, height: 2, background: "#fff", borderRadius: 2, marginBottom: 5 }} />
          <div style={{ width: 16, height: 2, background: "#fff", borderRadius: 2 }} />
        </div>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 17 }}>{greeting}, {userName || "Carer"} ☀️</div>
        <div style={{ position: "relative", cursor: "pointer" }} onClick={onProfile}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2a3 3 0 100 6 3 3 0 000-6zM4 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div style={{ position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: COLORS.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>3</div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px" }}>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", padding: "40px 0" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((d) => <div key={d} className={`dot-${d + 1}`} style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.teal }} />)}
            </div>
            <div style={{ color: COLORS.g4, fontSize: 14 }}>Loading your schedule…</div>
          </div>
        )}

        {!loading && clients.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ color: COLORS.g4, fontSize: 14, marginBottom: 8 }}>No visits scheduled today</div>
            <div style={{ color: COLORS.g4, fontSize: 12 }}>Check back later or contact your coordinator</div>
          </div>
        )}

        {/* Shift Progress */}
        <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#0f2040", fontWeight: 700, fontSize: 15 }}>Shift Progress</div>
            <div style={{ color: COLORS.g4, fontSize: 13, marginTop: 4 }}>{doneCount} of {totalVisits} visits completed</div>
          </div>
          <div style={{ position: "relative", width: 64, height: 64 }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6"/>
              <circle cx="32" cy="32" r="28" fill="none" stroke={COLORS.teal} strokeWidth="6"
                strokeDasharray={`${(progress / 100) * circumference} ${circumference}`}
                strokeLinecap="round" transform="rotate(-90 32 32)"/>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#0f2040", fontSize: 13, fontWeight: 700 }}>{progress}%</div>
          </div>
        </div>

        {/* Next Visit */}
        {nextClient && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ color: "#0f2040", fontWeight: 700, fontSize: 15 }}>Next Visit</div>
              <div style={{ color: COLORS.teal, fontWeight: 600, fontSize: 13 }}>in 25 min</div>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 72, height: 72, borderRadius: 16, background: "linear-gradient(135deg, #e8f4f8, #d0eaf5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, flexShrink: 0 }}>👵</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#0f2040", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{nextClient.name}</div>
                <div style={{ color: COLORS.g4, fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5C4.3 1.5 2.5 3.3 2.5 5.5c0 3 4 7 4 7s4-4 4-7c0-2.2-1.8-4-4-4z" stroke={COLORS.g4} strokeWidth="1.2" fill="none"/><circle cx="6.5" cy="5.5" r="1.3" fill={COLORS.g4}/></svg>
                  {nextClient.address}
                </div>
                <div style={{ color: COLORS.g4, fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke={COLORS.g4} strokeWidth="1.2" fill="none"/><path d="M6.5 3.5v3l2 2" stroke={COLORS.g4} strokeWidth="1.2" strokeLinecap="round"/></svg>
                  {nextClient.time}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 99, background: "#edfafa", color: COLORS.teal2, fontSize: 12, fontWeight: 600 }}>💊 Medication due</span>
                  <span style={{ padding: "3px 10px", borderRadius: 99, background: "#fff3e6", color: "#f97316", fontSize: 12, fontWeight: 600 }}>High Priority</span>
                </div>
              </div>
            </div>
            <button onClick={() => onSelectClient(nextClient.id)} style={{ width: "100%", marginTop: 14, padding: "14px 0", borderRadius: 999, border: "none", background: COLORS.teal, color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "DM Sans, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 16px rgba(79,209,197,0.4)" }}>
              Start Visit <span style={{ fontSize: 18 }}>→</span>
            </button>
          </div>
        )}

        {/* Today's Schedule */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ color: "#0f2040", fontWeight: 700, fontSize: 15 }}>Today's Schedule</div>
          <button style={{ color: COLORS.teal, fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>View all</button>
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
          {clients.map((client, idx) => {
            const status = visitStatuses[client.id] || "pending";
            const isActive = status === "in-progress";
            const isDone = status === "completed";
            return (
              <div key={client.id} onClick={() => !isDone && onSelectClient(client.id)}
                style={{ minWidth: 100, background: isActive ? "#edfafa" : "#fff", borderRadius: 16, padding: "12px 10px", border: `1.5px solid ${isActive ? COLORS.teal : "#e2e8f0"}`, cursor: isDone ? "default" : "pointer", textAlign: "center", boxShadow: isActive ? "0 2px 12px rgba(79,209,197,0.2)" : "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ color: isActive ? COLORS.teal2 : COLORS.g4, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{client.time.split("–")[0].trim()}</div>
                <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${isActive ? COLORS.teal : "#cbd5e1"}`, background: isDone ? COLORS.teal : "#fff", margin: "0 auto 6px" }} />
                <div style={{ color: "#0f2040", fontWeight: 700, fontSize: 13 }}>{client.name.split(" ")[0]} {client.name.split(" ")[1]?.[0]}.</div>
                <div style={{ color: isActive ? COLORS.teal2 : "#94a3b8", fontSize: 11, marginTop: 3 }}>{isDone ? "Done ✓" : isActive ? `In ${25 - idx * 8} min` : "Upcoming"}</div>
              </div>
            );
          })}
        </div>

        {/* AI Shift Briefing + Quick Actions side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {/* AI Briefing */}
          <div style={{ background: "#fff", borderRadius: 20, padding: "14px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ color: "#0f2040", fontWeight: 700, fontSize: 13 }}>AI Shift Briefing</div>
              <span style={{ padding: "2px 8px", borderRadius: 99, background: "#edfafa", color: COLORS.teal2, fontSize: 10, fontWeight: 700 }}>New</span>
            </div>
            <div style={{ color: COLORS.g4, fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>Personalised summary for your upcoming visits.</div>
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#0f2040", fontFamily: "DM Sans, sans-serif", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              <span style={{ fontSize: 10 }}>▶</span> Play Briefing
            </button>
            <div style={{ marginTop: 10, height: 28, display: "flex", alignItems: "center", gap: 2 }}>
              {WAVEFORM_HEIGHTS.map((h, i) => (
                <div key={i} style={{ width: 3, height: h, background: i < 8 ? COLORS.teal : "#e2e8f0", borderRadius: 99 }} />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ background: "#fff", borderRadius: 20, padding: "14px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ color: "#0f2040", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Medication", svg: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="6" y="3" width="8" height="14" rx="2" stroke="#38B2AC" strokeWidth="1.4"/><path d="M6 9.5h8" stroke="#38B2AC" strokeWidth="1.2"/></svg> },
                { label: "Voice Note", svg: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="7" y="2" width="6" height="10" rx="3" stroke="#38B2AC" strokeWidth="1.4"/><path d="M4 11c0 3.3 2.7 6 6 6s6-2.7 6-6M10 17v2" stroke="#38B2AC" strokeWidth="1.4" strokeLinecap="round"/></svg> },
                { label: "Care Notes", svg: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="3" stroke="#38B2AC" strokeWidth="1.4"/><path d="M6 7h8M6 10h6M6 13h4" stroke="#38B2AC" strokeWidth="1.2" strokeLinecap="round"/></svg> },
                { label: "More", svg: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="5" cy="10" r="1.5" fill="#38B2AC"/><circle cx="10" cy="10" r="1.5" fill="#38B2AC"/><circle cx="15" cy="10" r="1.5" fill="#38B2AC"/></svg> },
              ].map((a) => (
                <div key={a.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", borderRadius: 12, background: "#f8fafc", cursor: "pointer" }}>
                  {a.svg}
                  <span style={{ color: "#475569", fontSize: 11, fontWeight: 500, textAlign: "center" }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Health Alerts */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "14px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #fde8e8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#0f2040", fontWeight: 700, fontSize: 14 }}>Health Alerts</span>
              <span style={{ background: COLORS.red, color: "#fff", borderRadius: "50%", width: 20, height: 20, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>2</span>
            </div>
            <button style={{ color: COLORS.teal, fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>View all</button>
          </div>
          <div style={{ color: COLORS.red, fontSize: 13, fontWeight: 600 }}>Allergy: Penicillin &nbsp;•&nbsp; Fall Risk: High</div>
        </div>
      </div>

      {/* Floating SOS */}
      <button onClick={onSOS} style={{ position: "absolute", bottom: 88, right: 20, width: 64, height: 64, borderRadius: "50%", border: "4px solid #fff", background: COLORS.red, color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10, boxShadow: "0 4px 20px rgba(255,90,95,0.5)", gap: 1 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v6M9 12v1.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 11, letterSpacing: 0.5 }}>SOS</span>
      </button>

      {/* Bottom Nav */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px" }}>
        {[
          { label: "Dashboard", active: true, action: undefined as undefined | (() => void), svg: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1V9.5z" stroke={COLORS.teal} strokeWidth="1.6" fill="none"/></svg> },
          { label: "Visits", active: false, action: onRota, svg: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="5" width="16" height="14" rx="2" stroke="#94a3b8" strokeWidth="1.6"/><path d="M7 3v4M15 3v4M3 11h16" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round"/></svg> },
          { label: "Clients", active: false, action: onOperations, svg: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="9" cy="7" r="3.5" stroke="#94a3b8" strokeWidth="1.6"/><path d="M3 18c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a3 3 0 000-6M19 18c0-2.5-1.5-4.5-3.5-5.5" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round"/></svg> },
          { label: "Messages", active: false, action: onAssistant, svg: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6l-4 3V5z" stroke="#94a3b8" strokeWidth="1.6" fill="none"/></svg> },
          { label: "More", active: false, action: onProfile, svg: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="5" cy="11" r="1.5" fill="#94a3b8"/><circle cx="11" cy="11" r="1.5" fill="#94a3b8"/><circle cx="17" cy="11" r="1.5" fill="#94a3b8"/></svg> },
        ].map((n) => (
          <div key={n.label} onClick={n.action} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: n.action ? "pointer" : "default", gap: 3 }}>
            {n.svg}
            <span style={{ color: n.active ? COLORS.teal : "#94a3b8", fontSize: 11, fontWeight: n.active ? 700 : 500 }}>{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
