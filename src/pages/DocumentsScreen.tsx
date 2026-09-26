import { useState, useEffect, useCallback } from 'react'
import { useRoute, useLocation } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { getDocuments, generateDocument, saveDocument, getReports, get } from '../api/client'
import { getToken, setToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'
import { FileText, Sparkles, AlertCircle, CheckCircle, Clock, ChevronLeft, Plus } from 'lucide-react'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
}

const DOC_TEMPLATES = [
  { id: 'incident_report' as const, label: 'Incident Report', desc: 'CQC-aligned incident documentation' },
  { id: 'care_assessment_summary' as const, label: 'Assessment Summary', desc: 'Care assessment write-up' },
  { id: 'general_letter' as const, label: 'General Letter', desc: 'Letter to family, GP, or commissioner' },
]

type Tab = 'documents' | 'reports'
type View = 'list' | 'new' | 'view'

export default function DocumentsScreen() {
  const [, setLocation] = useLocation()
  const [, params] = useRoute('/tenant/:slug/manager/documents')

  const [tab, setTab] = useState<Tab>('documents')
  const [view, setView] = useState<View>('list')
  const [documents, setDocuments] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // New document state
  const [templateType, setTemplateType] = useState<(typeof DOC_TEMPLATES)[number]['id']>('incident_report')
  const [docInput, setDocInput] = useState('')
  const [docClientId, setDocClientId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [docs, reps] = await Promise.all([
        getDocuments() as Promise<any>,
        getReports().catch(() => ({ reports: [] })) as Promise<any>,
      ])
      setDocuments(docs.documents || [])
      setReports(reps.reports || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let token = getToken()
    if (!token) {
      secureGet('token').then((t) => {
        if (t) { setToken(t); load() }
        else { setLocation('/login') }
      })
    } else {
      load()
    }
  }, [load])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await generateDocument({
        templateType,
        input: docInput,
        clientId: docClientId || undefined,
      }) as any
      setDraft({ ...res, clientId: docClientId || undefined })
      setView('view')
    } catch (err: any) {
      setError(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async (confirm: boolean) => {
    if (!draft) return
    setSaving(true)
    try {
      await saveDocument({
        templateType: draft.templateType,
        title: draft.title,
        content: draft.content,
        clientId: draft.clientId,
        confirm,
      })
      setDraft(null)
      setView('list')
      load()
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const statusChip = (status: string) => (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: status === 'confirmed' ? `${COLORS.green}22` : `${COLORS.amber}22`,
        color: status === 'confirmed' ? COLORS.green : COLORS.amber,
      }}
    >
      {status}
    </span>
  )

  const renderContent = (content: any) =>
    typeof content === 'string' ? content : JSON.stringify(content, null, 2)

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="text-teal" size={28} />
            Documents & Reports
          </h1>
          <button
            onClick={() => setLocation(`/tenant/${params?.slug}/manager`)}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['documents', 'reports'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setView('list'); setSelected(null); setDraft(null) }}
              className={`px-5 py-2 rounded-lg font-medium capitalize transition-colors ${
                tab === t ? 'bg-teal text-navy' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {t} ({t === 'documents' ? documents.length : reports.length})
            </button>
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 flex items-center gap-2"
            >
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {view === 'list' && (
          <div className="bg-white/5 backdrop-blur rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold capitalize">{tab}</h3>
              {tab === 'documents' && (
                <button
                  onClick={() => setView('new')}
                  className="px-4 py-2 bg-teal text-navy rounded-lg font-medium flex items-center gap-2 hover:opacity-90"
                >
                  <Plus size={16} /> New Document
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-white/50 text-center py-12">Loading…</div>
            ) : tab === 'documents' ? (
              documents.length === 0 ? (
                <div className="text-white/40 text-center py-12">No documents yet. Generate one to get started.</div>
              ) : (
                <div className="space-y-2">
                  {documents.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => { setSelected(d); setView('view') }}
                      className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="text-white font-medium">{d.title}</div>
                        <div className="text-white/50 text-sm">
                          {d.template_type}{d.client_name ? ` • ${d.client_name}` : ''} • {new Date(d.created_at).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                      {statusChip(d.status)}
                    </button>
                  ))}
                </div>
              )
            ) : reports.length === 0 ? (
              <div className="text-white/40 text-center py-12">No saved reports yet — generated reports are stored automatically.</div>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={async () => {
                      try {
                        const full = await get(`/reports?id=${r.id}`) as any
                        setSelected(full.report)
                        setView('view')
                      } catch (err: any) {
                        setError(err.message || 'Failed to load report')
                      }
                    }}
                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-white font-medium">{r.title || r.report_type}</div>
                      <div className="text-white/50 text-sm">
                        {r.report_type}{r.client_name ? ` • ${r.client_name}` : ''} • {new Date(r.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </div>
                    <ChevronLeft size={16} className="text-white/40 rotate-180" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'new' && (
          <div className="bg-white/5 backdrop-blur rounded-xl p-5 space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('list')} className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20">
                <ChevronLeft size={18} />
              </button>
              <h3 className="text-white font-semibold">New Document</h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {DOC_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setTemplateType(tpl.id)}
                  className={`p-4 rounded-lg text-left transition-all ${
                    templateType === tpl.id ? 'bg-teal/20 border-2 border-teal' : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="text-white font-medium">{tpl.label}</div>
                  <div className="text-white/50 text-sm">{tpl.desc}</div>
                </button>
              ))}
            </div>

            <div>
              <label className="text-white/70 text-sm mb-1 block">Client ID (optional)</label>
              <input
                value={docClientId}
                onChange={(e) => setDocClientId(e.target.value)}
                placeholder="e.g. client-abc123"
                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-teal"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm mb-1 block">Source material</label>
              <textarea
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                placeholder="Paste visit notes, incident details, or context for the document…"
                className="w-full h-32 p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 resize-none focus:outline-none focus:border-teal"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !docInput.trim()}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles size={18} /> {generating ? 'Generating…' : 'Generate Draft'}
            </button>
          </div>
        )}

        {view === 'view' && (
          <div className="bg-white/5 backdrop-blur rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('list'); setSelected(null); setDraft(null) }}
                className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
              >
                <ChevronLeft size={18} />
              </button>
              <h3 className="text-white font-semibold flex-1">
                {draft ? draft.title || 'Generated draft' : selected?.title || selected?.report_type || 'Detail'}
              </h3>
              {(draft?.status || selected?.status) && statusChip(draft ? 'draft' : selected.status)}
            </div>

            <div className="bg-white/10 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
              <pre className="text-white/90 text-sm whitespace-pre-wrap font-mono">
                {renderContent(draft ? draft.content : selected?.content)}
              </pre>
            </div>

            {draft && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Clock size={18} /> Save Draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-teal text-navy rounded-xl font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} /> {saving ? 'Saving…' : 'Confirm & Save'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
