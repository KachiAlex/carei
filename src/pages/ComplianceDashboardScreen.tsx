import { useState, useEffect } from 'react'
import { useRoute, useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { getComplianceDashboard } from '../api/client'
import { getToken, setToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
}

export default function ComplianceDashboardScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/tenant/:slug/manager/compliance')

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getComplianceDashboard() as any
      setData(res)
    } catch (err: any) {
      setError(err.message || 'Failed to load compliance data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let token = getToken()
    if (!token) {
      secureGet('token').then((t) => {
        if (t) { setToken(t); loadDashboard() }
        else { setLocation('/login'); }
      })
    } else {
      loadDashboard()
    }
  }, [])

  const score = data?.score ?? 0
  const rating = data?.rating ?? 'Unknown'
  const items = data?.items ?? []
  const summary = data?.summary ?? {}

  const scoreColor = score >= 80 ? COLORS.green : score >= 60 ? COLORS.amber : COLORS.red

  const statusIcon = (status: string) => {
    if (status === 'compliant') return <CheckCircle size={18} style={{ color: COLORS.green }} />
    if (status === 'warning') return <AlertTriangle size={18} style={{ color: COLORS.amber }} />
    return <XCircle size={18} style={{ color: COLORS.red }} />
  }

  const groupedItems = items.reduce((acc: Record<string, any[]>, item: any) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Shield className="text-teal" size={28} />
              Compliance Dashboard
            </h1>
            <p className="text-white/70">CQC-aligned compliance monitoring across DBS, training, supervision, and audits</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 flex items-center gap-2"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setLocation(`/tenant/${params?.slug}/manager`)}
              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
            >
              Back
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64 text-white">
            <div className="w-12 h-12 border-4 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 backdrop-blur rounded-xl p-6 col-span-1"
              >
                <p className="text-white/60 text-sm mb-2">Overall Compliance Score</p>
                <div className="text-5xl font-bold" style={{ color: scoreColor }}>{score}</div>
                <div className="mt-2 text-lg font-medium" style={{ color: scoreColor }}>{rating}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/5 backdrop-blur rounded-xl p-6"
              >
                <p className="text-white/60 text-sm mb-2">Compliant</p>
                <div className="text-3xl font-bold" style={{ color: COLORS.green }}>
                  {items.filter((i: any) => i.status === 'compliant').length}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 backdrop-blur rounded-xl p-6"
              >
                <p className="text-white/60 text-sm mb-2">Warnings</p>
                <div className="text-3xl font-bold" style={{ color: COLORS.amber }}>
                  {items.filter((i: any) => i.status === 'warning').length}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/5 backdrop-blur rounded-xl p-6"
              >
                <p className="text-white/60 text-sm mb-2">Non-Compliant</p>
                <div className="text-3xl font-bold" style={{ color: COLORS.red }}>
                  {items.filter((i: any) => i.status === 'non-compliant').length}
                </div>
              </motion.div>
            </div>

            {/* Summary Cards */}
            {Object.keys(summary).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {Object.entries(summary).map(([key, val]: [string, any]) => (
                  <div key={key} className="bg-white/5 rounded-lg p-4">
                    <p className="text-white/50 text-xs capitalize mb-1">{key.replace(/_/g, ' ')}</p>
                    <p className="text-white font-semibold">{val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Items by Category */}
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([category, catItems]: [string, any]) => (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 backdrop-blur rounded-xl overflow-hidden"
                >
                  <div className="p-4 border-b border-white/10">
                    <h3 className="text-white font-semibold capitalize">{category.replace(/_/g, ' ')}</h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {(catItems as any[]).map((item: any, idx: number) => (
                      <div key={idx} className="p-4 flex items-start gap-3 hover:bg-white/5">
                        <div className="mt-1">{statusIcon(item.status)}</div>
                        <div className="flex-1">
                          <p className="text-white font-medium">{item.item}</p>
                          <p className="text-white/60 text-sm">{item.detail}</p>
                          {item.dueDate && (
                            <p className="text-white/40 text-xs mt-1">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                          )}
                          <p className="text-teal/60 text-xs mt-1 italic">CQC: {item.cqcStatement}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-white/40">
            <p>No compliance data available</p>
          </div>
        )}
      </div>
    </div>
  )
}
