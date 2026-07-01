import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion } from 'framer-motion'
import { getClient, getCarePlan } from '../api/client'
import { getToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
  lavender: '#A78BFA',
}

interface Client {
  id: string
  name: string
  age: number
  conditions: string[]
  allergies?: string
  supportFramework?: string
  communicationGuidance?: string
  mobility?: string
  medications?: { name: string; dose: string; notes?: string }[]
}

interface CarePlan {
  id?: string
  status?: string
  version?: number
  objectives?: string[]
  preventive?: string[]
  risks?: string[]
  post_med?: string[]
  last_review?: string[]
  pbs_triggers?: string[]
  safety_plan?: string[]
  pbs_calm_signs?: string[]
  pbs_calm_actions?: string[]
  pbs_anxious_signs?: string[]
  pbs_anxious_actions?: string[]
  pbs_risk_signs?: string[]
  pbs_risk_actions?: string[]
}

export default function CarePlanScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/client/:id/care-plan')
  const clientId = params?.id || ''
  const [client, setClient] = useState<Client | null>(null)
  const [plan, setPlan] = useState<CarePlan | null>(null)
  const [tab, setTab] = useState<'overview' | 'pbs' | 'medications' | 'history'>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    ;(async () => {
      let token = getToken()
      if (!token) {
        token = await secureGet('token')
      }
      try {
        const [c, p] = await Promise.all([
          getClient(clientId) as Promise<any>,
          getCarePlan(clientId) as Promise<any>,
        ])
        setClient(c)
        setPlan(p.plan)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    })()
  }, [clientId])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>
  }
  if (!client) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Client not found</div>
  }

  const pbs = plan || {}

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button onClick={() => setLocation(`/client/${clientId}/overview`)} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <h1 className="font-serif text-lg font-bold">Care Plan</h1>
        <p className="text-white/50 text-sm">{client.name}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 bg-white border-b border-slate-200 shrink-0 overflow-x-auto">
        {[
          { key: 'overview' as const, label: 'Overview' },
          { key: 'pbs' as const, label: 'PBS / Framework' },
          { key: 'medications' as const, label: 'Medications' },
          { key: 'history' as const, label: 'History' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-3 text-xs font-semibold border-none bg-transparent cursor-pointer transition-colors whitespace-nowrap"
            style={{
              color: tab === t.key ? COLORS.teal : '#94a3b8',
              borderBottom: `2px solid ${tab === t.key ? COLORS.teal : 'transparent'}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 overflow-auto">
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
            {/* Status Badge */}
            {plan?.status && (
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.status === 'published' ? 'bg-green-100 text-green-700' : plan.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {plan.status.toUpperCase()}{plan.version ? ` · v${plan.version}` : ''}
                </span>
              </div>
            )}
            {/* Conditions */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-sm text-slate-800">Conditions</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">From client profile</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {client.conditions?.map((c) => (
                  <span key={c} className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>{c}</span>
                )) || <span className="text-xs text-slate-400">No conditions recorded</span>}
              </div>
            </div>
            {/* Allergies */}
            {client.allergies && (
              <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-red-600">Allergies</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">From client profile</span>
                </div>
                <p className="text-sm text-red-700">{client.allergies}</p>
              </div>
            )}
            {/* Care Objectives */}
            {plan?.objectives && plan.objectives.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-sm text-slate-800">Care Objectives</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">From care plan</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {plan.objectives.map((item, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="text-[10px] font-bold text-teal shrink-0">{i + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Preventive Strategies */}
            {plan?.preventive && plan.preventive.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-sm text-slate-800">Preventive Strategies</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">From care plan</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {plan.preventive.map((item, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: COLORS.teal }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Risks */}
            {plan?.risks && plan.risks.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-sm text-red-700">Risks & Precautions</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">From care plan</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {plan.risks.map((item, i) => (
                    <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: COLORS.red }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* PBS Triggers */}
            {plan?.pbs_triggers && plan.pbs_triggers.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-sm text-slate-800">PBS Triggers</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">From care plan</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {plan.pbs_triggers.map((t, i) => (
                    <span key={i} className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(167,139,250,0.1)', color: COLORS.lavender }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {/* Safety Plan */}
            {plan?.safety_plan && plan.safety_plan.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-sm text-red-700">Safety Plan</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">From care plan</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {plan.safety_plan.map((item, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="text-[10px] font-bold text-red-500 shrink-0">{i + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Post-Med Monitoring */}
            {plan?.post_med && plan.post_med.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-sm text-slate-800">Post-Medication Monitoring</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">From care plan</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {plan.post_med.map((item, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: COLORS.teal }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Review Details */}
            {plan?.last_review && plan.last_review.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-sm text-slate-800">Review Details</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">From care plan</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {plan.last_review.map((item, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: COLORS.amber }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Support Level */}
            {client.supportFramework && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-slate-800">Support Framework</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">From client profile</span>
                </div>
                <p className="text-sm text-slate-600">{client.supportFramework}</p>
              </div>
            )}
            {/* Communication */}
            {client.communicationGuidance && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-slate-800">Communication Guidance</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">From client profile</span>
                </div>
                <p className="text-sm text-slate-600">{client.communicationGuidance}</p>
              </div>
            )}
            {/* Mobility */}
            {client.mobility && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-slate-800">Mobility</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">From client profile</span>
                </div>
                <p className="text-sm text-slate-600">{client.mobility}</p>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'pbs' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
            {/* Phase 5: Enhanced PBS Framework - Green / Amber / Red State Cards */}
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">PBS Framework States</div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">From care plan</span>
            </div>
            
            {/* GREEN State - Calm */}
            <div className="rounded-2xl p-4 border" style={{ background: 'rgba(34,197,94,0.04)', borderColor: 'rgba(34,197,94,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
                <h3 className="font-bold text-sm" style={{ color: '#16a34a' }}>🟢 Green State — Calm & Engaged</h3>
              </div>
              {pbs.pbs_calm_signs && pbs.pbs_calm_signs.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Signs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {pbs.pbs_calm_signs.map((sign: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white border" style={{ borderColor: 'rgba(34,197,94,0.2)', color: '#16a34a' }}>{sign}</span>
                    ))}
                  </div>
                </div>
              )}
              {pbs.pbs_calm_actions && pbs.pbs_calm_actions.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Actions</div>
                  <ul className="flex flex-col gap-1">
                    {pbs.pbs_calm_actions.map((action: string, i: number) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#22c55e' }} />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(!pbs.pbs_calm_signs || pbs.pbs_calm_signs.length === 0) && (!pbs.pbs_calm_actions || pbs.pbs_calm_actions.length === 0) && (
                <p className="text-xs text-slate-500">Client is calm, cooperative, and engaged. Maintain routine and positive reinforcement.</p>
              )}
            </div>

            {/* AMBER State - Anxious */}
            <div className="rounded-2xl p-4 border" style={{ background: 'rgba(246,183,60,0.04)', borderColor: 'rgba(246,183,60,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: COLORS.amber }} />
                <h3 className="font-bold text-sm" style={{ color: '#d97706' }}>🟠 Amber State — Early Distress</h3>
              </div>
              {pbs.pbs_anxious_signs && pbs.pbs_anxious_signs.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Warning Signs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {pbs.pbs_anxious_signs.map((sign: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white border" style={{ borderColor: 'rgba(246,183,60,0.3)', color: '#d97706' }}>{sign}</span>
                    ))}
                  </div>
                </div>
              )}
              {pbs.pbs_anxious_actions && pbs.pbs_anxious_actions.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Response Actions</div>
                  <ul className="flex flex-col gap-1">
                    {pbs.pbs_anxious_actions.map((action: string, i: number) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: COLORS.amber }} />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(!pbs.pbs_anxious_signs || pbs.pbs_anxious_signs.length === 0) && (!pbs.pbs_anxious_actions || pbs.pbs_anxious_actions.length === 0) && (
                <p className="text-xs text-slate-500">Client showing early signs of distress. Use de-escalation techniques and redirection.</p>
              )}
            </div>

            {/* RED State - Risk */}
            <div className="rounded-2xl p-4 border" style={{ background: 'rgba(255,90,95,0.04)', borderColor: 'rgba(255,90,95,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: COLORS.red }} />
                <h3 className="font-bold text-sm" style={{ color: '#dc2626' }}>🔴 Red State — High Distress / Crisis</h3>
              </div>
              {pbs.pbs_risk_signs && pbs.pbs_risk_signs.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Risk Signs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {pbs.pbs_risk_signs.map((sign: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white border" style={{ borderColor: 'rgba(255,90,95,0.3)', color: '#dc2626' }}>{sign}</span>
                    ))}
                  </div>
                </div>
              )}
              {pbs.pbs_risk_actions && pbs.pbs_risk_actions.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Immediate Actions</div>
                  <ul className="flex flex-col gap-1">
                    {pbs.pbs_risk_actions.map((action: string, i: number) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: COLORS.red }} />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(!pbs.pbs_risk_signs || pbs.pbs_risk_signs.length === 0) && (!pbs.pbs_risk_actions || pbs.pbs_risk_actions.length === 0) && (
                <p className="text-xs text-slate-500">Client in crisis. Prioritize safety, create space, and call for support immediately.</p>
              )}
            </div>

            {/* De-escalation Steps */}
            {plan?.safety_plan && plan.safety_plan.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-sm text-slate-800 mb-2">De-escalation Steps (from Safety Plan)</h3>
                <ol className="flex flex-col gap-1.5">
                  {plan.safety_plan.map((s, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="text-[10px] font-bold text-teal shrink-0">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'medications' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Medications</div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">From client profile</span>
            </div>
            {(client.medications || []).map((med, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-sm text-slate-800">{med.name}</h3>
                </div>
                <div className="text-xs text-slate-500 mb-1">{med.dose}</div>
                {med.notes && <div className="text-[10px] text-slate-400 bg-slate-50 rounded-lg p-2">{med.notes}</div>}
              </div>
            ))}
            {(!client.medications || client.medications.length === 0) && (
              <div className="text-center text-sm text-slate-400 py-8">No medications recorded in client profile</div>
            )}
          </motion.div>
        )}

        {tab === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
              <div className="text-sm text-slate-400 py-4">Visit history will appear here once visits are completed for this client.</div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
