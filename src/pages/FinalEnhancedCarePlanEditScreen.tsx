import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getCarePlan,
  createCarePlan,
  updateCarePlan,
  publishCarePlan,
  fetchClient,
  generateCarePlan,
} from '../api/client'
import { getToken, setToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'
import TagInput from '../components/TagInput'
import PBSStateCard from '../components/PBSStateCard'
import ValidationHelper, { VALIDATION_RULES, validateField } from '../components/ValidationHelper'
import ClientProfileIntegration from '../components/ClientProfileIntegration'
import RiskAssessmentTool from '../components/RiskAssessmentTool'
import CarePackageIntegration from '../components/CarePackageIntegration'
import RealTimeCollaboration from '../components/RealTimeCollaboration'
import ChangeTracking from '../components/ChangeTracking'
import ApprovalWorkflow from '../components/ApprovalWorkflow'
import VoiceInput from '../components/VoiceInput'
import { getTemplateSuggestions, getPBSTemplateSuggestions } from '../data/carePlanTemplates'
import { ChevronDown, ChevronUp, Save, Send, Eye, EyeOff, Lightbulb, AlertCircle, Mic, Users, History, CheckCircle, Sparkles } from 'lucide-react'

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
  useTagInput?: boolean
  maxTags?: number
}

const SECTIONS: SectionDef[] = [
  { key: 'objectives', label: 'Care Objectives', subtitle: 'What the carer should achieve each visit', placeholder: 'Add care objectives...', useTagInput: true, maxTags: 10 },
  { key: 'preventive', label: 'Preventive Strategies', subtitle: 'Risk mitigation steps', placeholder: 'Add preventive strategies...', useTagInput: true, maxTags: 8 },
  { key: 'risks', label: 'Risks & Precautions', subtitle: 'Active risks with severity context', placeholder: 'Add risks and precautions...', useTagInput: true, maxTags: 8 },
  { key: 'postMed', label: 'Post-Medication Monitoring', subtitle: 'Per-drug monitoring instructions', placeholder: 'Add monitoring instructions...', useTagInput: true, maxTags: 10 },
  { key: 'pbsTriggers', label: 'PBS Triggers', subtitle: 'What causes distress or behaviour escalation', placeholder: 'Add triggers...', useTagInput: true, maxTags: 6 },
  { key: 'safetyPlan', label: 'Safety Plan', subtitle: 'Escalation steps for unsafe situations', placeholder: 'Add safety steps...', useTagInput: true, maxTags: 8 },
  { key: 'lastReview', label: 'Review Details', subtitle: 'Last reviewed, next review, care package, framework', placeholder: 'Add review details...', useTagInput: true, maxTags: 10 },
]

export default function FinalEnhancedCarePlanEditScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/tenant/:slug/manager/clients/:id/care-plan/final')
  const clientId = params?.id || ''

  const [clientName, setClientName] = useState('')
  const [clientConditions, setClientConditions] = useState<string[]>([])
  const [clientMedications, setClientMedications] = useState<{ name: string; dose: string; frequency: string }[]>([])
  const [clientAge, setClientAge] = useState<number | undefined>()
  const [planId, setPlanId] = useState<string | null>(null)
  const [status, setStatus] = useState<'draft' | 'published' | 'archived' | null>(null)
  const [version, setVersion] = useState(0)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null)

  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['objectives']))
  const [showGuidance, setShowGuidance] = useState<Set<string>>(new Set())

  // Each field stores array of strings for tag-based inputs
  const [fields, setFields] = useState<Record<string, string[]>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  // PBS fields are arrays for signs and actions
  const [pbsCalmSigns, setPbsCalmSigns] = useState<string[]>([])
  const [pbsCalmActions, setPbsCalmActions] = useState<string[]>([])
  const [pbsAnxiousSigns, setPbsAnxiousSigns] = useState<string[]>([])
  const [pbsAnxiousActions, setPbsAnxiousActions] = useState<string[]>([])
  const [pbsRiskSigns, setPbsRiskSigns] = useState<string[]>([])
  const [pbsRiskActions, setPbsRiskActions] = useState<string[]>([])

  // Auto-save state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null)

  // Voice input state
  const [voiceInputSection, setVoiceInputSection] = useState<string | null>(null)

  // AI generate state
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiAssessmentText, setAiAssessmentText] = useState('')
  const [showAiModal, setShowAiModal] = useState(false)

  useEffect(() => {
    if (!clientId) return
    loadPlan()
  }, [clientId])

  // Auto-save effect
  useEffect(() => {
    if (hasUnsavedChanges && !loading) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      const timer = setTimeout(() => {
        handleAutoSave()
      }, 3000) // Auto-save after 3 seconds of inactivity
      setAutoSaveTimer(timer)
    }
    
    return () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
    }
  }, [hasUnsavedChanges, fields, pbsCalmSigns, pbsCalmActions, pbsAnxiousSigns, pbsAnxiousActions, pbsRiskSigns, pbsRiskActions])

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
      setClientConditions(clientRes.conditions || [])
      setClientMedications(clientRes.medications || [])
      setClientAge(clientRes.age)

      const res = await getCarePlan(clientId) as any
      const plan = res.plan
      if (plan) {
        setPlanId(plan.id)
        setStatus(plan.status)
        setVersion(plan.version || 1)
        setLastSaved(plan.updated_at ? new Date(plan.updated_at).toLocaleString() : null)

        setFields({
          objectives: plan.objectives || [],
          preventive: plan.preventive || [],
          risks: plan.risks || [],
          postMed: plan.post_med || [],
          pbsTriggers: plan.pbs_triggers || [],
          safetyPlan: plan.safety_plan || [],
          lastReview: plan.last_review || [],
        })

        setPbsCalmSigns(plan.pbs_calm_signs || [])
        setPbsCalmActions(plan.pbs_calm_actions || [])
        setPbsAnxiousSigns(plan.pbs_anxious_signs || [])
        setPbsAnxiousActions(plan.pbs_anxious_actions || [])
        setPbsRiskSigns(plan.pbs_risk_signs || [])
        setPbsRiskActions(plan.pbs_risk_actions || [])
      } else {
        // No plan yet - start with empty fields
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

  const toggleGuidance = (key: string) => {
    setShowGuidance(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleFieldChange = (key: string, value: string[]) => {
    setFields(prev => ({ ...prev, [key]: value }))
    setHasUnsavedChanges(true)
  }

  const handleAutoSave = async () => {
    if (!planId || !hasUnsavedChanges) return
    
    try {
      const payload = buildPayload()
      await updateCarePlan(planId, payload)
      setLastSaved(new Date().toLocaleString())
      setHasUnsavedChanges(false)
    } catch (err) {
      // Silent fail for auto-save
      console.error('Auto-save failed:', err)
    }
  }

  const buildPayload = () => {
    return {
      objectives: fields.objectives || [],
      preventive: fields.preventive || [],
      risks: fields.risks || [],
      postMed: fields.postMed || [],
      lastReview: fields.lastReview || [],
      pbsTriggers: fields.pbsTriggers || [],
      safetyPlan: fields.safetyPlan || [],
      pbsCalmSigns,
      pbsCalmActions,
      pbsAnxiousSigns,
      pbsAnxiousActions,
      pbsRiskSigns,
      pbsRiskActions,
    }
  }

  const validateAllSections = () => {
    const errors: string[] = []
    
    for (const section of SECTIONS) {
      const rules = VALIDATION_RULES[section.key]
      if (rules) {
        const validation = validateField(section.key, fields[section.key] || [], rules)
        if (!validation.isValid) {
          errors.push(`${section.label}: ${validation.errors.join(', ')}`)
        }
      }
    }
    
    // Validate PBS sections
    const pbsSections = [
      { name: 'Calm State', signs: pbsCalmSigns, actions: pbsCalmActions },
      { name: 'Anxious State', signs: pbsAnxiousSigns, actions: pbsAnxiousActions },
      { name: 'Risk State', signs: pbsRiskSigns, actions: pbsRiskActions }
    ]
    
    for (const pbs of pbsSections) {
      if (pbs.signs.length === 0 || pbs.actions.length === 0) {
        errors.push(`${pbs.name}: Both signs and actions are required`)
      }
    }
    
    return errors
  }

  const handleSave = async () => {
    const errors = validateAllSections()
    if (errors.length > 0) {
      setError(`Please fix the following issues:\n${errors.join('\n')}`)
      return
    }

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
      setHasUnsavedChanges(false)
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    const errors = validateAllSections()
    if (errors.length > 0) {
      setError(`Please fix the following issues before publishing:\n${errors.join('\n')}`)
      return
    }

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
      setHasUnsavedChanges(false)
    } catch (err: any) {
      setError(err.message || 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  const handleVoiceTranscript = (text: string, section: string) => {
    const items = text.split(/[.,;]+/).map(item => item.trim()).filter(item => item.length > 0)
    handleFieldChange(section, [...(fields[section] || []), ...items])
    setVoiceInputSection(null)
  }

  const handleAIGenerate = async () => {
    setAiGenerating(true)
    setError('')
    setMsg('')
    try {
      const res = await generateCarePlan({
        clientId,
        assessmentText: aiAssessmentText || undefined,
      }) as any

      const plan = res.plan || res
      if (plan) {
        if (plan.objectives) setFields(prev => ({ ...prev, objectives: plan.objectives }))
        if (plan.preventive) setFields(prev => ({ ...prev, preventive: plan.preventive }))
        if (plan.risks) setFields(prev => ({ ...prev, risks: plan.risks }))
        if (plan.postMed) setFields(prev => ({ ...prev, postMed: plan.postMed }))
        if (plan.pbsTriggers) setFields(prev => ({ ...prev, pbsTriggers: plan.pbsTriggers }))
        if (plan.safetyPlan) setFields(prev => ({ ...prev, safetyPlan: plan.safetyPlan }))
        if (plan.lastReview) setFields(prev => ({ ...prev, lastReview: plan.lastReview }))
        if (plan.pbsCalmSigns) setPbsCalmSigns(plan.pbsCalmSigns)
        if (plan.pbsCalmActions) setPbsCalmActions(plan.pbsCalmActions)
        if (plan.pbsAnxiousSigns) setPbsAnxiousSigns(plan.pbsAnxiousSigns)
        if (plan.pbsAnxiousActions) setPbsAnxiousActions(plan.pbsAnxiousActions)
        if (plan.pbsRiskSigns) setPbsRiskSigns(plan.pbsRiskSigns)
        if (plan.pbsRiskActions) setPbsRiskActions(plan.pbsRiskActions)
        setHasUnsavedChanges(true)
        setMsg('AI-generated care plan loaded. Review and edit before saving.')
        setShowAiModal(false)
      } else {
        setError('AI did not return a valid care plan')
      }
    } catch (err: any) {
      setError(err.message || 'AI generation failed')
    } finally {
      setAiGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.darkNavy }}>
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Loading care plan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Advanced Care Plan Editor</h1>
              <p className="text-white/70">{clientName} • {status === 'published' ? 'Published' : 'Draft'} • Version {version}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setLocation(`/tenant/${params?.slug}/manager/clients/${clientId}`)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                Back to Client
              </button>
            </div>
          </div>
          
          {/* Status and Actions */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${status === 'published' ? 'bg-green-400' : 'bg-amber-400'}`} />
                <span className="text-white text-sm">
                  {status === 'published' ? 'Published' : 'Draft'}
                  {hasUnsavedChanges && ' (unsaved changes)'}
                </span>
              </div>
              {lastSaved && (
                <span className="text-white/50 text-sm">Last saved: {lastSaved}</span>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowAiModal(true)}
                disabled={aiGenerating}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles size={16} />
                {aiGenerating ? 'Generating...' : 'AI Generate'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-teal text-navy rounded-lg font-medium hover:bg-teal/90 disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !planId}
                className="px-4 py-2 bg-green text-white rounded-lg font-medium hover:bg-green/90 disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={16} />
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={20} />
                <pre className="whitespace-pre-wrap">{error}</pre>
              </div>
            </motion.div>
          )}
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200"
            >
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Integration Tools */}
        <div className="space-y-6 mb-8">
          <ClientProfileIntegration
            clientId={clientId}
            onImportConditions={(conditions) => handleFieldChange('objectives', [...fields.objectives || [], ...conditions])}
            onImportMedications={(medications) => handleFieldChange('postMed', [...fields.postMed || [], ...medications])}
            onImportPreferences={(preferences) => handleFieldChange('objectives', [...fields.objectives || [], ...preferences])}
          />
          
          <RiskAssessmentTool
            clientConditions={clientConditions}
            clientMedications={clientMedications}
            clientAge={clientAge}
            onRiskUpdate={(assessment) => {
              // Auto-populate risks based on assessment
              if (assessment.recommendations.length > 0) {
                handleFieldChange('risks', [...fields.risks || [], ...assessment.recommendations])
              }
            }}
          />
          
          <CarePackageIntegration
            clientId={clientId}
            onPackageUpdate={() => {}}
            onObjectivesGenerated={(objectives) => handleFieldChange('objectives', [...fields.objectives || [], ...objectives])}
          />
        </div>

        {/* Collaboration Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <RealTimeCollaboration
            carePlanId={planId || ''}
            currentUserId="current-user"
            onConflictResolve={(section, value) => {
              handleFieldChange(section, value)
            }}
            onCommentAdd={(comment) => {
              // Handle comment addition
            }}
          />
          
          <ChangeTracking
            carePlanId={planId || ''}
            currentVersion={version}
            onVersionRestore={(version) => {
              // Handle version restore
            }}
            onVersionCompare={(v1, v2) => {
              // Handle version comparison
            }}
          />
        </div>

        {/* Approval Workflow */}
        <div className="mb-8">
          <ApprovalWorkflow
            carePlanId={planId || ''}
            currentUserId="current-user"
            currentUserRole="manager"
            onWorkflowStart={() => {}}
            onApprovalComplete={() => {}}
          />
        </div>

        {/* Care Plan Sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => {
            const isOpen = openSections.has(section.key)
            const showHelp = showGuidance.has(section.key)
            const sectionValue = fields[section.key] || []
            const suggestions = getTemplateSuggestions(section.key)
            
            return (
              <motion.div
                key={section.key}
                className="bg-white/5 backdrop-blur rounded-xl overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: SECTIONS.indexOf(section) * 0.1 }}
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal/20 rounded-lg flex items-center justify-center">
                      <span className="text-teal font-bold text-sm">
                        {sectionValue.length}
                      </span>
                    </div>
                    <div className="text-left">
                      <h3 className="text-white font-semibold">{section.label}</h3>
                      <p className="text-white/50 text-sm">{section.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setVoiceInputSection(voiceInputSection === section.key ? null : section.key)
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        voiceInputSection === section.key
                          ? 'bg-teal/20 text-teal'
                          : 'text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                      title="Voice input"
                    >
                      <Mic size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleGuidance(section.key)
                      }}
                      className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {showHelp ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    {isOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                  </div>
                </button>

                {/* Section Content */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 border-t border-white/10">
                        {section.useTagInput ? (
                          <TagInput
                            tags={sectionValue}
                            onChange={(tags) => handleFieldChange(section.key, tags)}
                            placeholder={section.placeholder}
                            suggestions={suggestions}
                            maxTags={section.maxTags}
                          />
                        ) : (
                          <textarea
                            value={sectionValue.join('\n')}
                            onChange={(e) => handleFieldChange(section.key, e.target.value.split('\n'))}
                            placeholder={section.placeholder}
                            className="w-full h-32 p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 resize-none focus:outline-none focus:border-teal"
                          />
                        )}
                        
                        {/* Voice Input */}
                        {voiceInputSection === section.key && (
                          <div className="mt-3">
                            <VoiceInput
                              onTranscript={(text) => handleVoiceTranscript(text, section.key)}
                              className="bg-white/5"
                            />
                          </div>
                        )}
                        
                        {/* Validation Helper */}
                        <ValidationHelper
                          field={section.key}
                          value={sectionValue}
                          rules={VALIDATION_RULES[section.key] || {}}
                          showGuidance={showHelp}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}

          {/* PBS Framework Section */}
          <motion.div
            className="bg-white/5 backdrop-blur rounded-xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: SECTIONS.length * 0.1 }}
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Lightbulb className="text-amber-400" size={24} />
                <div>
                  <h3 className="text-white font-semibold">Positive Behaviour Support Framework</h3>
                  <p className="text-white/50 text-sm">Traffic light system for behaviour management</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <PBSStateCard
                state="calm"
                signs={pbsCalmSigns}
                actions={pbsCalmActions}
                onSignsChange={setPbsCalmSigns}
                onActionsChange={setPbsCalmActions}
                suggestions={{
                  signs: getPBSTemplateSuggestions('calm', 'signs'),
                  actions: getPBSTemplateSuggestions('calm', 'actions')
                }}
              />
              
              <PBSStateCard
                state="anxious"
                signs={pbsAnxiousSigns}
                actions={pbsAnxiousActions}
                onSignsChange={setPbsAnxiousSigns}
                onActionsChange={setPbsAnxiousActions}
                suggestions={{
                  signs: getPBSTemplateSuggestions('anxious', 'signs'),
                  actions: getPBSTemplateSuggestions('anxious', 'actions')
                }}
              />
              
              <PBSStateCard
                state="risk"
                signs={pbsRiskSigns}
                actions={pbsRiskActions}
                onSignsChange={setPbsRiskSigns}
                onActionsChange={setPbsRiskActions}
                suggestions={{
                  signs: getPBSTemplateSuggestions('risk', 'signs'),
                  actions: getPBSTemplateSuggestions('risk', 'actions')
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* AI Generate Modal */}
        <AnimatePresence>
          {showAiModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
              onClick={() => !aiGenerating && setShowAiModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-navy rounded-2xl p-6 max-w-lg w-full"
                onClick={(e) => e.stopPropagation()}
                style={{ background: COLORS.navy }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="text-purple-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">AI Care Plan Generator</h3>
                    <p className="text-white/60 text-sm">Generate a draft from client data or free-text assessment</p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-white/70 text-sm mb-2 block">
                    Assessment notes (optional — leave blank to use client profile data)
                  </label>
                  <textarea
                    value={aiAssessmentText}
                    onChange={(e) => setAiAssessmentText(e.target.value)}
                    placeholder="e.g. Client has recently had a fall, increased confusion at night, needs support with personal care and medication..."
                    className="w-full h-28 p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 resize-none focus:outline-none focus:border-purple-400"
                    disabled={aiGenerating}
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowAiModal(false)}
                    disabled={aiGenerating}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAIGenerate}
                    disabled={aiGenerating}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Sparkles size={16} />
                    {aiGenerating ? 'Generating...' : 'Generate Plan'}
                  </button>
                </div>

                {aiGenerating && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-white/60 text-sm">
                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    AI is analysing client data and generating care plan...
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
