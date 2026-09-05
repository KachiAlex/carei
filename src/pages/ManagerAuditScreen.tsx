import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { useTenant } from '../contexts/TenantContext'
import { motion } from 'framer-motion'
import { getAuditLogs, exportAuditLogsUrl } from '../api/client'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  red: '#FF5A5F',
  amber: '#F6B73C',
  lavender: '#A78BFA',
}

const ACTION_ICONS: Record<string, string> = {
  login: '🔑',
  logout: '🚪',
  visit_start: '📋',
  visit_complete: '✅',
  medication_admin: '💊',
  incident_report: '⚠️',
  sos_alert: '🚨',
  audit_logs_export: '📤',
  client_access: '👁️',
  data_export: '📦',
}

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  visit_start: 'Visit Started',
  visit_complete: 'Visit Completed',
  medication_admin: 'Medication Given',
  incident_report: 'Incident Reported',
  sos_alert: 'SOS Triggered',
  audit_logs_export: 'Audit Log Exported',
  client_access: 'Client Record Accessed',
  data_export: 'Data Exported',
}

export default function ManagerAuditScreen() {
  const [, setLocation] = useLocation()
  const { currentTenant } = useTenant()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    loadLogs()
  }, [currentTenant?.slug])

  const loadLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = { limit: 200 }
      if (fromDate) params.from = fromDate
      if (toDate) params.to = toDate
      if (actionFilter) params.action = actionFilter
      const data = await getAuditLogs(params)
      setLogs(data.logs || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCsv = () => {
    const url = exportAuditLogsUrl({ from: fromDate, to: toDate, action: actionFilter })
    window.open(url, '_blank')
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const actionOptions = [
    { value: '', label: 'All actions' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'visit_start', label: 'Visit Started' },
    { value: 'visit_complete', label: 'Visit Completed' },
    { value: 'medication_admin', label: 'Medication' },
    { value: 'incident_report', label: 'Incident' },
    { value: 'sos_alert', label: 'SOS' },
    { value: 'audit_logs_export', label: 'Audit Export' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <button
          onClick={() => currentTenant && setLocation(`/tenant/${currentTenant.slug}/manager`)}
          className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors mb-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Dashboard
        </button>
        <h1 className="font-serif text-lg font-bold">Audit Trail</h1>
        <p className="text-white/50 text-sm">Who accessed or changed what</p>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-sm px-2 py-1.5 rounded-lg border border-slate-200"
            placeholder="From"
          />
          <span className="text-sm text-slate-400">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-sm px-2 py-1.5 rounded-lg border border-slate-200"
            placeholder="To"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
          >
            {actionOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadLogs}
            className="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white border-none cursor-pointer hover:bg-teal-700 transition-colors"
          >
            Apply Filters
          </button>
          <button
            onClick={handleExportCsv}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Logs list */}
      <div className="flex-1 px-4 py-4 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(255,90,95,0.08)', color: COLORS.red, border: `1px solid ${COLORS.red}25` }}>
            {error}
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            No audit entries found for the selected filters.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {logs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(79,209,197,0.08)' }}>
                  {ACTION_ICONS[log.action] || '📋'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{formatDate(log.createdAt)}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    User: <span className="font-medium text-slate-700">{log.userId || 'Unknown'}</span>
                    {log.resource && (
                      <span className="ml-2">· {log.resource}</span>
                    )}
                  </div>
                  {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                    <div className="mt-1.5 text-[10px] text-slate-400 bg-slate-50 rounded-lg px-2 py-1">
                      {JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    log.statusCode && log.statusCode >= 400
                      ? 'bg-red-50 text-red-600 border border-red-100'
                      : 'bg-green-50 text-green-600 border border-green-100'
                  }`}>
                    {log.statusCode || 'OK'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
