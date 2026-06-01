import { useState } from "react";

const C = {
  navy: "#1B2A49", dark: "#0F1D34", teal: "#4FD1C5", teal2: "#38B2AC",
  amber: "#F6B73C", red: "#FF5A5F", green: "#22C55E",
  g0: "#F8FAFC", g1: "#E2E8F0", g2: "#94A3B8", g3: "#475569", g4: "#64748B",
};

const CARERS = [
  { name: "Sarah Johnson",  client: "Grace Mensah",    time: "10:00–11:30", status: "Active", gps: "2 min ago",  x: 52, y: 38 },
  { name: "Amy Mitchell",   client: "Patricia Lane",   time: "10:15–11:45", status: "Late",   gps: "18 min ago", x: 68, y: 45 },
  { name: "James Osei",     client: "Robert Turner",   time: "09:30–11:00", status: "Active", gps: "3 min ago",  x: 35, y: 58 },
  { name: "David Chen",     client: "—",               time: "—",           status: "Break",  gps: "5 min ago",  x: 74, y: 28 },
  { name: "Priya Patel",    client: "Alan Simmons",    time: "11:00–12:30", status: "Done",   gps: "1 min ago",  x: 44, y: 70 },
  { name: "Kemi Adeyemi",   client: "Margaret Cole",   time: "10:30–12:00", status: "Active", gps: "4 min ago",  x: 58, y: 62 },
  { name: "Tom Bridges",    client: "Frank Novak",     time: "09:00–10:30", status: "Done",   gps: "45 min ago", x: 28, y: 42 },
];

const CLIENTS = [
  { name: "Grace Mensah",    dob: "12/03/1942", carer: "Sarah Johnson",  last: "Today 10:00", status: "Active", med: true,  risk: "Medium" },
  { name: "Patricia Lane",   dob: "05/07/1938", carer: "Amy Mitchell",   last: "Today 10:15", status: "Active", med: false, risk: "High"   },
  { name: "Robert Turner",   dob: "22/11/1945", carer: "James Osei",     last: "Today 09:30", status: "Active", med: true,  risk: "Low"    },
  { name: "Alan Simmons",    dob: "14/04/1950", carer: "Priya Patel",    last: "Today 11:00", status: "Active", med: true,  risk: "Low"    },
  { name: "Margaret Cole",   dob: "03/09/1940", carer: "Kemi Adeyemi",   last: "Today 10:30", status: "Active", med: false, risk: "Medium" },
  { name: "Frank Novak",     dob: "18/01/1948", carer: "Tom Bridges",    last: "Today 09:00", status: "Active", med: true,  risk: "Low"    },
];

const AUDIT = [
  { time: "10:49", event: "Medication confirmed — Atorvastatin 20mg", carer: "Sarah Johnson", s: "ok"   },
  { time: "10:48", event: "Medication confirmed — Metformin 500mg",   carer: "Sarah Johnson", s: "ok"   },
  { time: "10:47", event: "Medication confirmed — Amlodipine 5mg",    carer: "Sarah Johnson", s: "ok"   },
  { time: "10:33", event: "Lone worker check-in overdue (18 min)",    carer: "Amy Mitchell",  s: "warn" },
  { time: "10:15", event: "Visit started — Patricia Lane",            carer: "Amy Mitchell",  s: "ok"   },
  { time: "10:00", event: "Visit started — Grace Mensah",             carer: "Sarah Johnson", s: "ok"   },
  { time: "09:42", event: "Medication flagged — out of stock note",   carer: "James Osei",    s: "warn" },
  { time: "09:30", event: "Visit started — Robert Turner",            carer: "James Osei",    s: "ok"   },
  { time: "09:00", event: "Visit started — Frank Novak",              carer: "Tom Bridges",   s: "ok"   },
  { time: "07:55", event: "CQC flag — medication gap not documented", carer: "System",        s: "fail" },
];

const ALERTS = [
  { id: 1, sev: "Critical", type: "Lone Worker", title: "Amy Mitchell — check-in overdue 18 min",
    detail: "Amy Mitchell has not checked in while lone working at Patricia Lane's home. Immediate supervisor action required.",
    time: "10:33" },
  { id: 2, sev: "High", type: "AI Flag", title: "Potential drug interaction — Robert Turner",
    detail: "AI Copilot flagged a possible interaction between Warfarin and Ibuprofen. Review before next visit.",
    time: "10:15" },
  { id: 3, sev: "Medium", type: "CQC", title: "Handover note missing — Margaret Cole",
    detail: "No ContinuCare+ handover submitted for Margaret Cole's 08:00 visit. Documentation gap flagged.",
    time: "09:50" },
  { id: 4, sev: "Low", type: "Schedule", title: "James Osei 8 min behind schedule",
    detail: "GPS tracking shows James Osei is 8 minutes behind for Robert Turner's visit. Client notified.",
    time: "09:22" },
];

type Section = "carers" | "clients" | "cqc" | "alerts";
type AlertFilter = "All" | "Critical" | "AI Flags";

function StatusChip({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    Active: ["rgba(34,197,94,0.15)", C.green],
    Late:   ["rgba(255,90,95,0.15)",  C.red],
    Done:   ["rgba(100,116,139,0.15)", C.g2],
    Break:  ["rgba(246,183,60,0.15)", C.amber],
  };
  const [bg, col] = map[s] || map.Done;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: bg, color: col }}>
      {s}
    </span>
  );
}

function RiskChip({ r }: { r: string }) {
  const map: Record<string, [string, string]> = {
    High:   ["rgba(255,90,95,0.15)",  C.red],
    Medium: ["rgba(246,183,60,0.15)", C.amber],
    Low:    ["rgba(34,197,94,0.15)",  C.green],
  };
  const [bg, col] = map[r] || map.Low;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: bg, color: col }}>{r}</span>
  );
}

function SevChip({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    Critical: ["rgba(255,90,95,0.2)",  C.red],
    High:     ["rgba(255,90,95,0.12)", "#ff8080"],
    Medium:   ["rgba(246,183,60,0.15)", C.amber],
    Low:      ["rgba(34,197,94,0.12)", C.green],
  };
  const [bg, col] = map[s] || map.Low;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: bg, color: col }}>{s}</span>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 90 ? C.green : pct >= 75 ? C.amber : C.red;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 42 42)" />
        <text x="42" y="46" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">{pct}%</text>
      </svg>
      <div style={{ color: C.g2, fontSize: 11, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function CarerOverview() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Table */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Live Shift Table</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Carer", "Client", "Time", "Status", "Last GPS"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.g2, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CARERS.map((c, i) => (
                <tr key={c.name} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none", background: c.status === "Late" ? "rgba(255,90,95,0.05)" : "transparent" }}>
                  <td style={{ padding: "10px 14px", color: "#fff", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>{c.name}</td>
                  <td style={{ padding: "10px 14px", color: C.g1, fontSize: 13 }}>{c.client}</td>
                  <td style={{ padding: "10px 14px", color: C.g2, fontSize: 12 }}>{c.time}</td>
                  <td style={{ padding: "10px 14px" }}><StatusChip s={c.status} /></td>
                  <td style={{ padding: "10px 14px", color: c.status === "Late" ? C.red : C.g3, fontSize: 12 }}>{c.gps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Lone worker map */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Lone Worker Map — Reading</div>
            <div style={{ display: "flex", gap: 12 }}>
              {[["Active", C.green], ["Late", C.red], ["Break", C.amber]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c as string }} />
                  <span style={{ color: C.g2, fontSize: 11 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", height: 280, background: "rgba(27,42,73,0.6)", overflow: "hidden" }}>
            {/* Grid lines */}
            {[20, 40, 60, 80].map(y => (
              <div key={y} style={{ position: "absolute", left: 0, right: 0, top: `${y}%`, borderTop: "1px solid rgba(255,255,255,0.04)" }} />
            ))}
            {[20, 40, 60, 80].map(x => (
              <div key={x} style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, borderLeft: "1px solid rgba(255,255,255,0.04)" }} />
            ))}
            {/* Map label */}
            <div style={{ position: "absolute", bottom: 8, left: 12, color: C.g3, fontSize: 10 }}>Reading, Berkshire · Approx locations</div>
            {/* Carer pins */}
            {CARERS.map(c => {
              const pinColor = c.status === "Active" ? C.green : c.status === "Late" ? C.red : c.status === "Break" ? C.amber : C.g3;
              return (
                <div key={c.name} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, transform: "translate(-50%,-50%)", zIndex: 5 }}>
                  {c.status === "Late" && (
                    <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${C.red}`, animation: "pulse-dot 1.5s ease-in-out infinite", opacity: 0.6 }} />
                  )}
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: pinColor, border: "2px solid rgba(255,255,255,0.3)", boxShadow: `0 0 8px ${pinColor}80` }} />
                  <div style={{ position: "absolute", left: "50%", top: 18, transform: "translateX(-50%)", background: "rgba(15,29,52,0.9)", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap", fontSize: 9, color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {c.name.split(" ")[0]}
                  </div>
                </div>
              );
            })}
            {/* Amy Mitchell warning */}
            <div style={{ position: "absolute", left: "68%", top: "30%", background: "rgba(255,90,95,0.15)", border: `1px solid ${C.red}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, color: C.red, fontWeight: 600, whiteSpace: "nowrap" }}>
              ⚠ Amy Mitchell — 18 min overdue
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientRoster() {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Client Roster</div>
        <div style={{ color: C.g2, fontSize: 12, marginTop: 2 }}>{CLIENTS.length} active clients</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)" }}>
            {["Client", "DOB", "Assigned Carer", "Last Visit", "Status", "Meds", "Risk"].map(h => (
              <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.g2, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CLIENTS.map((c, i) => (
            <tr key={c.name} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <td style={{ padding: "12px 16px", color: "#fff", fontSize: 13, fontWeight: 600 }}>{c.name}</td>
              <td style={{ padding: "12px 16px", color: C.g2, fontSize: 12 }}>{c.dob}</td>
              <td style={{ padding: "12px 16px", color: C.g1, fontSize: 13 }}>{c.carer}</td>
              <td style={{ padding: "12px 16px", color: C.g2, fontSize: 12 }}>{c.last}</td>
              <td style={{ padding: "12px 16px" }}><span style={{ color: C.green, fontSize: 12 }}>● Active</span></td>
              <td style={{ padding: "12px 16px" }}>
                {c.med
                  ? <span style={{ color: C.green, fontSize: 12, fontWeight: 600 }}>✓ Confirmed</span>
                  : <span style={{ color: C.amber, fontSize: 12, fontWeight: 600 }}>⚠ Pending</span>}
              </td>
              <td style={{ padding: "12px 16px" }}><RiskChip r={c.risk} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CQCAuditTrail() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      {/* Event log */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Audit Event Log</div>
          <button style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid rgba(79,209,197,0.3)`, background: "rgba(79,209,197,0.1)", color: C.teal, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
            ↓ Export CSV
          </button>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {AUDIT.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "12px 18px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "flex-start" }}>
              <div style={{ color: C.g3, fontSize: 12, whiteSpace: "nowrap", paddingTop: 1 }}>{a.time}</div>
              <div style={{ fontSize: 16 }}>{a.s === "ok" ? "✅" : a.s === "warn" ? "⚠️" : "🔴"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.g0, fontSize: 13 }}>{a.event}</div>
                <div style={{ color: C.g3, fontSize: 11, marginTop: 2 }}>{a.carer}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance meters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 20, textAlign: "center" }}>
          <Ring pct={94} label="Overall CQC Score" />
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 16 }}>
          {[["Medication Confirmations", 96], ["Visit Sign-offs", 91], ["ContinuCare+ Handovers", 88], ["Lone Worker Check-ins", 82]].map(([l, v]) => (
            <div key={l} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ color: C.g1, fontSize: 12 }}>{l}</span>
                <span style={{ color: Number(v) >= 90 ? C.green : C.amber, fontSize: 12, fontWeight: 700 }}>{v}%</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 5 }}>
                <div style={{ height: 5, borderRadius: 99, background: Number(v) >= 90 ? C.green : C.amber, width: `${v}%`, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgencyAlerts() {
  const [filter, setFilter] = useState<AlertFilter>("All");
  const [ackState, setAckState] = useState<Record<number, { open: boolean; text: string; done: boolean; time: string }>>({});

  const filtered = ALERTS.filter(a =>
    filter === "All" ? true : filter === "Critical" ? a.sev === "Critical" : a.type === "AI Flag"
  );

  function openAck(id: number) {
    setAckState(s => ({ ...s, [id]: { open: true, text: s[id]?.text ?? "", done: false, time: "" } }));
  }
  function submitAck(id: number) {
    const text = ackState[id]?.text?.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    setAckState(s => ({ ...s, [id]: { open: false, text, done: true, time } }));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["All", "Critical", "AI Flags"] as AlertFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 16px", borderRadius: 8, border: `1px solid ${filter === f ? C.teal : "rgba(255,255,255,0.1)"}`,
            background: filter === f ? "rgba(79,209,197,0.12)" : "transparent", color: filter === f ? C.teal : C.g2,
            fontWeight: filter === f ? 700 : 400, fontSize: 13, cursor: "pointer", fontFamily: "DM Sans, sans-serif",
          }}>{f}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(a => {
          const ack = ackState[a.id];
          return (
            <div key={a.id} style={{
              background: ack?.done ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.04)", borderRadius: 14, padding: "16px 20px",
              border: `1px solid ${ack?.done ? "rgba(34,197,94,0.2)" : a.sev === "Critical" ? "rgba(255,90,95,0.3)" : "transparent"}`,
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                <SevChip s={a.sev} />
                <span style={{ background: "rgba(255,255,255,0.08)", color: C.g1, padding: "2px 8px", borderRadius: 99, fontSize: 11 }}>{a.type}</span>
                <span style={{ marginLeft: "auto", color: C.g3, fontSize: 12 }}>{a.time}</span>
              </div>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{a.title}</div>
              <div style={{ color: C.g2, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{a.detail}</div>

              {/* Feature 6 — Supervisor Acknowledgement Log */}
              {ack?.done ? (
                <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ color: C.green, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>✓ Acknowledged — {ack.time}</div>
                  <div style={{ color: C.g2, fontSize: 12, lineHeight: 1.5 }}><span style={{ color: C.g3 }}>Action taken: </span>{ack.text}</div>
                </div>
              ) : ack?.open ? (
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ color: C.g1, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Supervisor action taken:</div>
                  <textarea
                    value={ack.text}
                    onChange={e => setAckState(s => ({ ...s, [a.id]: { ...s[a.id], text: e.target.value } }))}
                    placeholder="Describe the action taken (e.g. Called Amy Mitchell, confirmed safe. Logged in incident system.)"
                    rows={3}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontFamily: "DM Sans, sans-serif", fontSize: 12, resize: "none", outline: "none", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setAckState(s => ({ ...s, [a.id]: { ...s[a.id], open: false } }))} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: C.g2, fontSize: 12, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>Cancel</button>
                    <button onClick={() => submitAck(a.id)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: ack.text?.trim() ? `linear-gradient(90deg, ${C.teal}, ${C.teal2})` : "rgba(255,255,255,0.1)", color: ack.text?.trim() ? C.dark : C.g3, fontWeight: 700, fontSize: 12, cursor: ack.text?.trim() ? "pointer" : "not-allowed", fontFamily: "DM Sans, sans-serif" }}>
                      ✓ Submit Acknowledgement
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  {["Call", "Escalate", "Review"].map(btn => (
                    <button key={btn} style={{
                      padding: "6px 14px", borderRadius: 8, border: `1px solid rgba(255,255,255,0.15)`,
                      background: btn === "Escalate" ? "rgba(255,90,95,0.15)" : "rgba(255,255,255,0.06)",
                      color: btn === "Escalate" ? C.red : C.g1,
                      fontWeight: btn === "Escalate" ? 700 : 400, fontSize: 12, cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                    }}>{btn}</button>
                  ))}
                  <button onClick={() => openAck(a.id)} style={{
                    marginLeft: "auto", padding: "6px 14px", borderRadius: 8, border: `1px solid rgba(79,209,197,0.35)`,
                    background: "rgba(79,209,197,0.1)", color: C.teal, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                  }}>✓ Acknowledge</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<Section>("carers");

  const navItems: { key: Section; icon: string; label: string }[] = [
    { key: "carers",  icon: "👥", label: "Carer Overview" },
    { key: "clients", icon: "📋", label: "Client Roster" },
    { key: "cqc",    icon: "✅", label: "CQC Audit Trail" },
    { key: "alerts", icon: "🔔", label: "Agency Alerts" },
  ];

  const titles: Record<Section, string> = {
    carers:  "Carer Overview",
    clients: "Client Roster",
    cqc:     "CQC Audit Trail",
    alerts:  "Agency Alerts",
  };

  return (
    <div style={{ width: "100%", height: "100vh", overflowX: "auto", background: "#050d1a" }}>
    <div style={{ display: "flex", height: "100%", minWidth: 960, fontFamily: "DM Sans, sans-serif", color: C.g0 }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: C.dark, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "24px 20px 16px" }}>
          <div style={{ fontFamily: "DM Serif Display, serif", fontSize: 22, color: "#fff" }}>CAREi</div>
          <div style={{ color: C.teal, fontSize: 11, fontWeight: 600, marginTop: 2 }}>Admin Dashboard</div>
        </div>
        <div style={{ flex: 1, padding: "8px 12px" }}>
          {navItems.map(item => (
            <button key={item.key} onClick={() => setSection(item.key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 10, border: "none", background: section === item.key ? "rgba(79,209,197,0.12)" : "transparent",
              color: section === item.key ? C.teal : C.g2, fontWeight: section === item.key ? 600 : 400,
              fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "DM Sans, sans-serif", marginBottom: 4,
              borderLeft: section === item.key ? `3px solid ${C.teal}` : "3px solid transparent",
            }}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
        <div style={{ padding: 16 }}>
          <button onClick={onBack} style={{
            width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: C.g2, fontSize: 13, cursor: "pointer", fontFamily: "DM Sans, sans-serif",
          }}>← Back to App</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ padding: "18px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: C.dark, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>{titles[section]}</div>
            <div style={{ color: C.g2, fontSize: 13, marginTop: 2 }}>Adjoy Healthcare · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 16 }}>
              {[["7", "Carers on Shift"], ["2", "Active Alerts"], ["94%", "CQC Score"]].map(([v, l]) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ color: C.teal, fontWeight: 700, fontSize: 20 }}>{v}</div>
                  <div style={{ color: C.g3, fontSize: 10 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {section === "carers"  && <CarerOverview />}
          {section === "clients" && <ClientRoster />}
          {section === "cqc"    && <CQCAuditTrail />}
          {section === "alerts" && <AgencyAlerts />}
        </div>
      </div>
    </div>
    </div>
  );
}
