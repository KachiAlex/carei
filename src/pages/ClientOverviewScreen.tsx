import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useParams } from 'wouter'
import { getClient } from '../api/client'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  amber: '#F6B73C',
  red: '#FF5A5F',
  lavender: '#A78BFA',
}

interface ClientDetail {
  id: string
  name: string
  age: number
  address: string
  conditions: string[]
  medications: { name: string; dose: string; frequency: string }[]
  preferences: string
  emergencyContact: string
  allergies?: string
  dysphagiaProtocol?: string
  supportFramework?: string
  communicationGuidance?: string
  mobility?: string
  careCues?: string[]
}

export default function ClientOverviewScreen() {
  const params = useParams()
  const [, setLocation] = useLocation()
  const clientId = params.id || ''

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissedAllergy, setDismissedAllergy] = useState(false)
  const [dismissedChoking, setDismissedChoking] = useState(false)

  useEffect(() => {
    if (!clientId) return
    getClient(clientId)
      .then((data) => {
        setClient(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
        <div className="text-slate-500 text-sm font-medium mb-2">Client not found</div>
        <button
          onClick={() => setLocation('/dashboard')}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white border-none cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  const initials = client.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative items-center">
      <div className="w-full max-w-3xl flex flex-col min-h-screen relative pb-safe">
        {/* Header */}
        <div
          className="px-6 pt-5 pb-6 text-white shrink-0 relative overflow-hidden"
          style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none" style={{ background: COLORS.teal }} />

          <div className="relative z-10 flex items-center justify-between mb-5">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setLocation('/dashboard')}
              className="flex items-center gap-2 bg-transparent border-none cursor-pointer rounded-xl p-1 -ml-1 transition-colors hover:bg-white/5"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </motion.button>
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Pre-Visit Brief</div>
          </div>

          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
              style={{ background: `linear-gradient(135deg, ${COLORS.teal}30, ${COLORS.teal2}20)`, color: COLORS.teal }}
            >
              {initials}
            </div>
            <div>
              <h1 className="font-serif text-xl">{client.name}</h1>
              <div className="text-[11px] text-white/50">
                {client.age ? `${client.age} yrs · ` : ''}
                {client.address}
              </div>
            </div>
          </div>

          {/* Condition tags */}
          {client.conditions && client.conditions.length > 0 && (
            <div className="relative z-10 flex flex-wrap gap-1.5">
              {client.conditions.map((c) => (
                <span
                  key={c}
                  className="text-[10px] font-medium px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(79,209,197,0.12)', color: COLORS.teal, border: `1px solid ${COLORS.teal}20` }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-5 overflow-auto">
          {/* Allergy Banner */}
          {client.allergies && !dismissedAllergy && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-2xl p-4 border"
              style={{ background: 'rgba(255,90,95,0.06)', borderColor: `${COLORS.red}30` }}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,90,95,0.12)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" x2="12" y1="9" y2="13" />
                    <line x1="12" x2="12.01" y1="17" y2="17" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold mb-0.5" style={{ color: COLORS.red }}>Allergy Alert</div>
                  <div className="text-xs text-slate-600 leading-relaxed">{client.allergies}</div>
                </div>
                <button
                  onClick={() => setDismissedAllergy(true)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}

          {/* Choking Risk Banner */}
          {client.dysphagiaProtocol && !dismissedChoking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-2xl p-4 border"
              style={{ background: 'rgba(246,183,60,0.06)', borderColor: `${COLORS.amber}30` }}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(246,183,60,0.12)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold mb-0.5" style={{ color: COLORS.amber }}>Choking Risk — Dysphagia Protocol</div>
                  <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{client.dysphagiaProtocol}</div>
                </div>
                <button
                  onClick={() => setDismissedChoking(true)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}

          {/* Support Level & Framework */}
          {client.supportFramework && (
            <div className="mb-4 rounded-2xl p-4 border border-slate-100 bg-white">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Support Framework</div>
              <div className="text-sm font-medium text-slate-800">{client.supportFramework}</div>
            </div>
          )}

          {/* Communication Guidance */}
          {client.communicationGuidance && (
            <div className="mb-4 rounded-2xl p-4 border border-slate-100 bg-white">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Communication Guidance</div>
              <div className="text-xs text-slate-600 leading-relaxed">{client.communicationGuidance}</div>
            </div>
          )}

          {/* Mobility */}
          {client.mobility && (
            <div className="mb-4 rounded-2xl p-4 border border-slate-100 bg-white">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mobility</div>
              <div className="text-xs text-slate-600 leading-relaxed">{client.mobility}</div>
            </div>
          )}

          {/* Medication Summary */}
          {client.medications && client.medications.length > 0 && (
            <div className="mb-4 rounded-2xl p-4 border border-slate-100 bg-white">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Medication Summary</div>
              <div className="flex flex-col gap-2">
                {client.medications.map((med, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{med.name}</div>
                      <div className="text-[10px] text-slate-500">{med.dose} · {med.frequency}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Care Cues */}
          {client.careCues && client.careCues.length > 0 && (
            <div className="mb-4 rounded-2xl p-4 border border-slate-100 bg-white">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Contextual Care Cues</div>
              <div className="flex flex-col gap-2">
                {client.careCues.map((cue, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 px-3 rounded-xl" style={{ background: 'rgba(79,209,197,0.06)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                      <path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />
                    </svg>
                    <span className="text-xs text-slate-700 leading-relaxed">{cue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emergency Contact */}
          {client.emergencyContact && (
            <div className="mb-4 rounded-2xl p-4 border border-slate-100 bg-white">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Emergency Contact</div>
              <div className="text-sm text-slate-800">{client.emergencyContact}</div>
            </div>
          )}

          {/* Preferences */}
          {client.preferences && (
            <div className="mb-4 rounded-2xl p-4 border border-slate-100 bg-white">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Preferences</div>
              <div className="text-xs text-slate-600 leading-relaxed">{client.preferences}</div>
            </div>
          )}
        </div>

        {/* Sticky Start Visit Button */}
        <div className="shrink-0 px-4 pb-5 pt-2 bg-slate-50">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation(`/visit/${client.id}`)}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white border-none cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
          >
            Start Active Visit
          </motion.button>
        </div>
      </div>
    </div>
  )
}
