import { useState } from 'react'
import { useRoute, useLocation } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { generateReport } from '../api/client'
import { getToken, setToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'
import { FileText, Sparkles, AlertCircle, Download, Copy } from 'lucide-react'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
}

const TEMPLATES = [
  { id: 'incident-report', label: 'Incident Report', desc: 'Formal incident documentation with contributing factors' },
  { id: 'assessment-summary', label: 'Assessment Summary', desc: 'Initial or reassessment summary for care planning' },
  { id: 'care-review', label: 'Care Review', desc: 'Periodic care plan review with outcomes' },
  { id: 'visit-summary-report', label: 'Visit Summary Report', desc: 'Aggregated visit summaries over a period' },
  { id: 'safeguarding-referral', label: 'Safeguarding Referral', desc: 'Safeguarding concern referral narrative' },
  { id: 'compliance-audit', label: 'Compliance Audit', desc: 'Internal compliance audit narrative' },
]

export default function AIReportScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/tenant/:slug/manager/reports')

  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [inputText, setInputText] = useState('')
  const [clientId, setClientId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      setError('Please select a report template')
      return
    }
    setGenerating(true)
    setError('')
    setReport(null)
    try {
      const res = await generateReport({
        template: selectedTemplate,
        input: inputText || undefined,
        clientId: clientId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }) as any
      setReport(res.report || res)
    } catch (err: any) {
      setError(err.message || 'Report generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (report) {
      const text = typeof report === 'string' ? report : JSON.stringify(report, null, 2)
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (report) {
      const text = typeof report === 'string' ? report : JSON.stringify(report, null, 2)
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${selectedTemplate}-${Date.now()}.txt`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <FileText className="text-teal" size={28} />
                AI Report Generator
              </h1>
              <p className="text-white/70">Generate professional care reports from client data and visit records</p>
            </div>
            <button
              onClick={() => setLocation(`/tenant/${params?.slug}/manager`)}
              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 flex items-center gap-2"
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Configuration */}
          <div className="space-y-6">
            {/* Template Selection */}
            <div className="bg-white/5 backdrop-blur rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">1. Select Report Template</h3>
              <div className="grid grid-cols-1 gap-3">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`p-4 rounded-lg text-left transition-all ${
                      selectedTemplate === tpl.id
                        ? 'bg-teal/20 border-2 border-teal'
                        : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${selectedTemplate === tpl.id ? 'border-teal bg-teal' : 'border-white/30'}`} />
                      <div>
                        <h4 className="text-white font-medium">{tpl.label}</h4>
                        <p className="text-white/50 text-sm">{tpl.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Data */}
            <div className="bg-white/5 backdrop-blur rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">2. Provide Context (Optional)</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-white/70 text-sm mb-1 block">Client ID (for auto-loading visit data)</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="e.g. client-abc123"
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-teal"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/70 text-sm mb-1 block">Date From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-teal"
                    />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm mb-1 block">Date To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-teal"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/70 text-sm mb-1 block">Additional notes / free-text input</label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter any additional context for the report..."
                    className="w-full h-28 p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 resize-none focus:outline-none focus:border-teal"
                  />
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedTemplate}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              {generating ? 'Generating Report...' : 'Generate Report'}
            </button>
          </div>

          {/* Right: Output */}
          <div className="bg-white/5 backdrop-blur rounded-xl p-5 min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Generated Report</h3>
              {report && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                    title="Copy"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                </div>
              )}
            </div>

            {generating ? (
              <div className="flex flex-col items-center justify-center h-64 text-white/60">
                <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mb-4" />
                <p>AI is generating your report...</p>
              </div>
            ) : report ? (
              <div className="bg-white/10 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                <pre className="text-white/90 text-sm whitespace-pre-wrap font-mono">
                  {typeof report === 'string' ? report : JSON.stringify(report, null, 2)}
                </pre>
                {copied && <p className="text-teal text-sm mt-2">Copied to clipboard!</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-white/40">
                <FileText size={48} className="mb-4 opacity-50" />
                <p>Select a template and generate a report to see results here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
