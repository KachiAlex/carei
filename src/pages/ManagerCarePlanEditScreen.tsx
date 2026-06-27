import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getCarePlan,
  createCarePlan,
  updateCarePlan,
  publishCarePlan,
  fetchClient,
} from '../api/client'
import { getToken, setToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
}

interface SectionDef {
  key: string
  label: string
  subtitle: string
  placeholder: string
}

const SECTIONS: SectionDef[] = [
  { key: 'objectives', label: 'Care Objectives', subtitle: 'What the carer should achieve each visit', placeholder: 'Enter one objective per line...' },
  { key: 'preventive', label: 'Preventive Strategies', subtitle: 'Risk mitigation steps', placeholder: 'Enter one strategy per line...' },
  { key: 'risks', label: 'Risks & Precautions', subtitle: 'Active risks with severity context', placeholder: 'Enter one risk per line...' },
  { key: 'postMed', label: 'Post-Medication Monitoring', subtitle: 'Per-drug monitoring instructions', placeholder: 'Enter one instruction per line...' },
  { key: 'pbsTriggers', label: 'PBS Triggers', subtitle: 'What causes distress or behaviour escalation', placeholder: 'Enter one trigger per line...' },
  { key: 'pbsCalm', label: 'PBS — Calm State (Green)', subtitle: 'Signs and staff actions when client is calm', placeholder: 'Signs on first line, actions below...' },
  { key: 'pbsAnxious', label: 'PBS — Anxious State (Amber)', subtitle: 'Warning signs and response actions', placeholder: 'Signs on first line, actions below...' },
  { key: 'pbsRisk', label: 'PBS — Risk State (Red)', subtitle: 'Risk signs and immediate actions', placeholder: 'Signs on first line, actions below...' },
  { key: 'safetyPlan', label: 'Safety Plan', subtitle: 'Escalation steps for unsafe situations', placeholder: 'Enter one step per line...' },
  { key: 'lastReview', label: 'Review Details', subtitle: 'Last reviewed, next review, care package, framework', placeholder: 'Enter review details per line...' },
]

export default function ManagerCarePlanEditScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/tenant/:slug/manager/clients/:id/care-plan/edit')
  const clientId = params?.id || ''

  const [clientName, setClientName] = useState('')
  const [planId, setPlanId] = useState<string | null>(null)
  const [status, setStatus] = useState<'draft' | 'published' | 'archived' | null>(null)
  const [version, setVersion] = useState(0)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null)

  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['objectives']))

  // Each field stores raw textarea string (one item per line)
  const [fields, setFields] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  // PBS fields are split into signs + actions
  const [pbsCalmSigns, setPbsCalmSigns] = useState('')
  const [pbsCalmActions, setPbsCalmActions] = useState('')
  const [pbsAnxiousSigns, setPbsAnxiousSigns] = useState('')
  const [pbsAnxiousActions, setPbsAnxiousActions] = useState('')
  const [pbsRiskSigns, setPbsRiskSigns] = useState('')
  const [pbsRiskActions, setPbsRiskActions] = useState('')

  useEffect(() => {
    if (!clientId) return
    loadPlan()
  }, [clientId])

  const loadPlan = async () => {
    let token = getToken()
    if (!token) {
      token = await secureGet('token')
      if (token) setToken(token)
    }
    if (!token) {
      setLocation('/login')
      return
    }

    setLoading(true)
    try {
      const clientRes = await fetchClient(clientId) as any
      setClientName(clientRes.name || 'Client')

      const res = await getCarePlan(clientId) as any
      const plan = res.plan
      if (plan) {
        setPlanId(plan.id)
        setStatus(plan.status)
        setVersion(plan.version || 1)
        setLastSaved(plan.updated_at ? new Date(plan.updated_at).toLocaleString() : null)

        setFields({
          objectives: (plan.objectives || []).join('\n'),
          preventive: (plan.preventive || []).join('\n'),
          risks: (plan.risks || []).join('\n'),
          postMed: (plan.post_med || []).join('\n'),
          pbsTriggers: (plan.pbs_triggers || []).join('\n'),
          safetyPlan: (plan.safety_plan || []).join('\n'),
          lastReview: (plan.last_review || []).join('\n'),
        })

        setPbsCalmSigns((plan.pbs_calm_signs || []).join('\n'))
        setPbsCalmActions((plan.pbs_calm_actions || []).join('\n'))
        setPbsAnxiousSigns((plan.pbs_anxious_signs || []).join('\n'))
        setPbsAnxiousActions((plan.pbs_anxious_actions || []).join('\n'))
        setPbsRiskSigns((plan.pbs_risk_signs || []).join('\n'))
        setPbsRiskActions((plan.pbs_risk_actions || []).join('\n'))
      } else {
        // No plan yet — start with empty fields
        setFields({})
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load care plan')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const buildPayload = () => {
    const toArr = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean)
    return {
      objectives: toArr(fields.objectives || ''),
      preventive: toArr(fields.preventive || ''),
      risks: toArr(fields.risks || ''),
      postMed: toArr(fields.postMed || ''),
      lastReview: toArr(fields.lastReview || ''),
      pbsTriggers: toArr(fields.pbsTriggers || ''),
      safetyPlan: toArr(fields.safetyPlan || ''),
      pbsCalmSigns: toArr(pbsCalmSigns),
      pbsCalmActions: toArr(pbsCalmActions),
      pbsAnxiousSigns: toArr(pbsAnxiousSigns),
      pbsAnxiousActions: toArr(pbsAnxiousActions),
      pbsRiskSigns: toArr(pbsRiskSigns),
      pbsRiskActions: toArr(pbsRiskActions),
    }
  }

  const handleSave = async () => {
    setError('')
    setMsg('')
    setSaving(true)
    try {
      const payload = buildPayload()
      if (!planId) {
        const res = await createCarePlan({ clientId, ...payload }) as any
        setPlanId(res.id)
        setStatus('draft')
        setVersion(1)
        setMsg('Care plan created as draft')
      } else {
        const res = await updateCarePlan(planId, payload) as any
        setVersion(res.version)
        setMsg('Draft saved')
      }
      setLastSaved(new Date().toLocaleString())
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!planId) {
      setError('Save a draft first before publishing')
      return
    }
    setError('')
    setMsg('')
    setPublishing(true)
    try {
      // Auto-save any pending changes first
      const payload = buildPayload()
      await updateCarePlan(planId, payload)
      await publishCarePlan(planId)
      setStatus('published')
      setVersion(v => v + 1)
      setMsg('Care plan published successfully')
      setLastSaved(new Date().toLocaleString())
    } catch (err: any) {
      setError(err.message || 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  const renderTextarea = (key: string, value: string, onChange: (v: string) => void, placeholder: string) => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-teal transition-colors min-h-[120px] resize-y text-sm leading-relaxed"
    />
  )

  const renderPbsSection = (
    label: string,
    signsValue: string,
    setSigns: (v: string) => void,
    actionsValue: string,
    setActions: (v: string) => void,
    color: string,
    borderColor: string
  ) => (
    <div className="space-y-3">
      <div>
        <label className="block text-white/70 text-xs font-medium mb-1.5">Signs</label>
        {renderTextarea(`${label}-signs`, signsValue, setSigns, 'Enter one sign per line...')}
      </div>
      <div>
        <label className="block text-white/70 text-xs font-medium mb-1.5">Actions</label>
        {renderTextarea(`${label}-actions`, actionsValue, setActions, 'Enter one action per line...')}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        Loading care plan editor...
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 text-white">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setLocation(`/tenant/${params?.slug}/manager/clients`)}
            className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold border-none cursor-pointer disabled:opacity-50 transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || !planId}
              className="px-4 py-2 rounded-xl text-xs font-bold border-none cursor-pointer disabled:opacity-50 transition-all"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              {publishing ? 'Publishing...' : status === 'published' ? 'Update Published' : 'Publish'}
            </button>
          </div>
        </div>
        <h1 className="font-serif text-lg font-bold">Care Plan Editor</h1>
        <p className="text-white/50 text-sm">{clientName}</p>
        {lastSaved && (
          <p className="text-white/30 text-[10px] mt-1">Last saved: {lastSaved}{version ? ` · v${version}` : ''}{status ? ` · ${status}` : ''}</p>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-4 mb-3 rounded-xl px-4 py-2.5 text-xs font-medium text-red-300" style={{ background: 'rgba(255,90,95,0.1)' }}>
          {error}
        </div>
      )}
      {msg && (
        <div className="mx-4 mb-3 rounded-xl px-4 py-2.5 text-xs font-medium" style={{ background: 'rgba(34,197,94,0.1)', color: COLORS.green }}>
          {msg}
        </div>
      )}

      {/* Accordion Sections */}
      <div className="flex-1 px-4 pb-6 space-y-2 overflow-auto">
        {SECTIONS.map((section) => {
          const isOpen = openSections.has(section.key)
          const isPbs = section.key.startsWith('pbs') && section.key !== 'pbsTriggers'

          return (
            <div key={section.key} className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-transparent border-none cursor-pointer text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-white">{section.label}</div>
                  <div className="text-[10px] text-white/40">{section.subtitle}</div>
                </div>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="text-white/40 transition-transform"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      {isPbs ? (
                        section.key === 'pbsCalm' ? renderPbsSection('Calm', pbsCalmSigns, setPbsCalmSigns, pbsCalmActions, setPbsCalmActions, '#22c55e', 'rgba(34,197,94,0.2)') :
                        section.key === 'pbsAnxious' ? renderPbsSection('Anxious', pbsAnxiousSigns, setPbsAnxiousSigns, pbsAnxiousActions, setPbsAnxiousActions, COLORS.amber, 'rgba(246,183,60,0.3)') :
                        renderPbsSection('Risk', pbsRiskSigns, setPbsRiskSigns, pbsRiskActions, setPbsRiskActions, COLORS.red, 'rgba(255,90,95,0.3)')
                      ) : (
                        renderTextarea(section.key, fields[section.key] || '', (v) => {
                          setFields(prev => ({ ...prev, [section.key]: v }))
                        }, section.placeholder)
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {/* Bottom save bar */}
        <div className="pt-4 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold border-none cursor-pointer disabled:opacity-50 transition-all"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || !planId}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold border-none cursor-pointer disabled:opacity-50 transition-all"
            style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
          >
            {publishing ? 'Publishing...' : status === 'published' ? 'Update Published' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
