import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion } from 'framer-motion'
import { getClient } from '../api/client'

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
  pbsFramework?: {
    strategies?: string[]
    anxietySigns?: string[]
    escalationSteps?: string[]
    greenState?: string
    amberState?: string
    redState?: string
  }
}

export default function CarePlanScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/client/:id/care-plan')
  const clientId = params?.id || ''
  const [client, setClient] = useState<Client | null>(null)
  const [tab, setTab] = useState<'overview' | 'pbs' | 'medications' | 'history'>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    getClient(clientId)
      .then((c: any) => { setClient(c); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clientId])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>
  }
  if (!client) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Client not found</div>
  }

  const pbs = client.pbsFramework || {}

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
            {/* Conditions */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 mb-2">Conditions</h3>
              <div className="flex flex-wrap gap-1.5">
                {client.conditions?.map((c) => (
                  <span key={c} className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(79,209,197,0.08)', color: COLORS.teal }}>{c}</span>
                )) || <span className="text-xs text-slate-400">No conditions recorded</span>}
              </div>
            </div>
            {/* Allergies */}
            {client.allergies && (
              <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm">
                <h3 className="font-bold text-sm text-red-600 mb-1">Allergies</h3>
                <p className="text-sm text-red-700">{client.allergies}</p>
              </div>
            )}
            {/* Support Level */}
            {client.supportFramework && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-sm text-slate-800 mb-1">Support Framework</h3>
                <p className="text-sm text-slate-600">{client.supportFramework}</p>
              </div>
            )}
            {/* Communication */}
            {client.communicationGuidance && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-sm text-slate-800 mb-1">Communication Guidance</h3>
                <p className="text-sm text-slate-600">{client.communicationGuidance}</p>
              </div>
            )}
            {/* Mobility */}
            {client.mobility && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-sm text-slate-800 mb-1">Mobility</h3>
                <p className="text-sm text-slate-600">{client.mobility}</p>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'pbs' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
            {/* Green / Amber / Red States */}
            <div className="flex gap-2 mb-1">
              {[
                { key: 'green', label: 'Green', color: '#22c55e', desc: pbs.greenState || 'Calm and content' },
                { key: 'amber', label: 'Amber', color: COLORS.amber, desc: pbs.amberState || 'Showing early signs of distress' },
                { key: 'red', label: 'Red', color: COLORS.red, desc: pbs.redState || 'High distress / crisis' },
              ].map((s) => (
                <div key={s.key} className="flex-1 rounded-xl p-3 text-center" style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                  <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: s.color }} />
                  <div className="text-[10px] font-bold capitalize" style={{ color: s.color }}>{s.label}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">{s.desc}</div>
                </div>
              ))}
            </div>
            {/* Strategies */}
            {pbs.strategies && pbs.strategies.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-sm text-slate-800 mb-2">Behaviour Strategies</h3>
                <ul className="flex flex-col gap-1.5">
                  {pbs.strategies.map((s, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: COLORS.teal }} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Anxiety Signs */}
            {pbs.anxietySigns && pbs.anxietySigns.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-sm text-slate-800 mb-2">Anxiety / Distress Signs</h3>
                <ul className="flex flex-col gap-1.5">
                  {pbs.anxietySigns.map((s, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: COLORS.amber }} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* De-escalation */}
            {pbs.escalationSteps && pbs.escalationSteps.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-sm text-slate-800 mb-2">De-escalation Steps</h3>
                <ol className="flex flex-col gap-1.5">
                  {pbs.escalationSteps.map((s, i) => (
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
              <div className="text-center text-sm text-slate-400 py-8">No medications recorded</div>
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
