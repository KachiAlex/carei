import { useState, useEffect } from 'react'
import { useRoute, useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { getRiskAlerts } from '../api/client'
import { getToken, setToken } from '../utils/tokenCache'
import { secureGet } from '../utils/secureStorage'
import { AlertTriangle, RefreshCw, TrendingDown, Activity, Utensils, Pill, CalendarX, CheckCircle } from 'lucide-react'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
}

const alertIcons: Record<string, any> = {
  'repeated-falls': Activity,
  'medication-errors': Pill,
  'mood-decline': TrendingDown,
  'poor-intake': Utensils,
  'missed-visits': CalendarX,
}

const severityColors: Record<string, string> = {
  high: COLORS.red,
  medium: COLORS.amber,
  low: COLORS.teal,
}

export default function RiskAlertsScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/tenant/:slug/manager/risk-alerts')

  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAlerts = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getRiskAlerts() as any
      setAlerts(res.alerts || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load risk alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let token = getToken()
    if (!token) {
      secureGet('token').then((t) => {
        if (t) { setToken(t); loadAlerts() }
        else { setLocation('/login') }
      })
    } else {
      loadAlerts()
    }
  }, [])

  const highCount = alerts.filter(a => a.severity === 'high').length
  const medCount = alerts.filter(a => a.severity === 'medium').length
  const lowCount = alerts.filter(a => a.severity === 'low').length

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <AlertTriangle className="text-amber-400" size={28} />
              Risk Alerts
            </h1>
            <p className="text-white/70">Automated detection of incident patterns and emerging risks</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadAlerts}
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

        {/* Summary */}
        {!loading && alerts.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-white/60 text-sm">High Severity</p>
              <p className="text-3xl font-bold" style={{ color: COLORS.red }}>{highCount}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-white/60 text-sm">Medium</p>
              <p className="text-3xl font-bold" style={{ color: COLORS.amber }}>{medCount}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-white/60 text-sm">Low</p>
              <p className="text-3xl font-bold" style={{ color: COLORS.teal }}>{lowCount}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64 text-white">
            <div className="w-12 h-12 border-4 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/40">
            <CheckCircle size={48} className="mb-4" style={{ color: COLORS.green }} />
            <p className="text-lg">No risk alerts detected</p>
            <p className="text-sm">All clients are within normal parameters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert, idx) => {
              const Icon = alertIcons[alert.alertType] || AlertTriangle
              const color = severityColors[alert.severity] || COLORS.teal
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white/5 backdrop-blur rounded-xl p-5 border-l-4"
                  style={{ borderLeftColor: color }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                      <Icon size={20} style={{ color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-white font-semibold">{alert.clientName}</h3>
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${color}30`, color }}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-white/80 text-sm mb-2">{alert.message}</p>
                      <p className="text-white/50 text-sm">{alert.detail}</p>
                      {alert.data && Object.keys(alert.data).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(alert.data).map(([k, v]: [string, any]) => (
                            <span key={k} className="px-2 py-1 bg-white/5 rounded text-xs text-white/60">
                              {k.replace(/_/g, ' ')}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
