import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { useTenant } from '../contexts/TenantContext'
import { motion } from 'framer-motion'
import { exportVisits } from '../utils/exportCsv'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
  amber: '#F6B73C',
  lavender: '#A78BFA',
}

// Phase 8: Demo data for admin dashboard
interface Shift {
  id: string
  carer: string
  client: string
  startTime: string
  status: 'active' | 'completed' | 'scheduled'
  location: string
}

interface AuditEntry {
  id: string
  timestamp: string
  action: string
  user: string
  type: 'medication' | 'visit' | 'incident' | 'login'
}

interface AgencyAlert {
  id: string
  title: string
  severity: 'high' | 'medium' | 'low'
  timestamp: string
  description: string
}

export default function AdminTeaserScreen() {
  const [, setLocation] = useLocation()
  const { currentTenant } = useTenant()
  const [activeTab, setActiveTab] = useState<'overview' | 'shifts' | 'audit' | 'alerts'>('overview')
  
  const [shifts] = useState<Shift[]>([])
  const [auditTrail] = useState<AuditEntry[]>([])
  const [alerts] = useState<AgencyAlert[]>([])

  const complianceScore = 0
  const circumference = 2 * Math.PI * 40
  const dash = (complianceScore / 100) * circumference

  const highAlerts = alerts.filter(a => a.severity === 'high').length
  const activeShifts = shifts.filter(s => s.status === 'active').length

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 text-white shrink-0" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => currentTenant && setLocation(`/tenant/${currentTenant.slug}/manager`)} className="text-white/60 hover:text-white text-sm bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">Admin</span>
        </div>
        <h1 className="font-serif text-lg font-bold">Agency Admin</h1>
        <p className="text-white/50 text-sm">Live oversight & compliance</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-white">
        {[
          { key: 'overview', label: 'Overview', icon: '📊', badge: null },
          { key: 'shifts', label: 'Live Shifts', icon: '👥', badge: activeShifts },
          { key: 'audit', label: 'Audit Trail', icon: '📋', badge: null },
          { key: 'alerts', label: 'Alerts', icon: '🔔', badge: highAlerts },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="flex-1 py-3 text-sm font-medium cursor-pointer border-b-2 transition-all flex items-center justify-center gap-1"
            style={{
              borderColor: activeTab === tab.key ? COLORS.teal : 'transparent',
              color: activeTab === tab.key ? COLORS.teal : '#64748b',
              background: activeTab === tab.key ? 'rgba(79,209,197,0.04)' : 'white',
            }}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge ? (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white">{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
            {/* Compliance Ring */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
              <h3 className="font-bold text-sm text-slate-800 mb-4">Agency Compliance Score</h3>
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none" stroke={COLORS.teal} strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={0}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-800">{complianceScore}%</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3">Based on last 30 days of visits</div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Active Shifts', value: activeShifts, sub: 'On duty', color: COLORS.teal, icon: '👥' },
                { label: 'High Alerts', value: highAlerts, sub: 'Require attention', color: COLORS.red, icon: '🔔' },
                { label: 'Staff', value: '0', sub: 'No data', color: COLORS.lavender, icon: '👤' },
                { label: 'Clients', value: '0', sub: 'No data', color: COLORS.amber, icon: '🏠' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{stat.icon}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{stat.label}</span>
                  </div>
                  <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-[10px] text-slate-400">{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 mb-3">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                <button onClick={() => currentTenant && setLocation(`/tenant/${currentTenant.slug}/manager`)} className="text-left text-sm text-slate-600 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer bg-transparent border-none">
                  Manager Dashboard
                </button>
                <button onClick={() => { const saved = localStorage.getItem('carei_visits'); exportVisits(saved ? JSON.parse(saved) : []) }} className="text-left text-sm text-slate-600 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer bg-transparent border-none">
                  Export Visit Data
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Live Shift Table - Phase 8 */}
        {activeTab === 'shifts' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm text-slate-800">Live Shift Table</h3>
              <span className="flex items-center gap-1 text-[10px] font-medium text-teal-600">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live updates
              </span>
            </div>
            
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <div>Carer</div>
                <div>Client</div>
                <div>Status</div>
                <div>Location</div>
              </div>
              <div className="divide-y divide-slate-100">
                {shifts.map((shift) => (
                  <div key={shift.id} className="grid grid-cols-4 gap-2 p-3 text-sm hover:bg-slate-50 transition-colors">
                    <div className="font-medium text-slate-700">{shift.carer}</div>
                    <div className="text-slate-600">{shift.client}</div>
                    <div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        shift.status === 'active' ? 'bg-green-50 text-green-600 border border-green-100' :
                        shift.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                        'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {shift.status === 'active' ? '● Active' : shift.status}
                      </span>
                    </div>
                    <div className="text-slate-500 text-xs">{shift.location}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Audit Trail - Phase 8 */}
        {activeTab === 'audit' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
            <h3 className="font-bold text-sm text-slate-800">Audit Trail</h3>
            
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
              {auditTrail.map((entry) => (
                <div key={entry.id} className="p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    entry.type === 'medication' ? 'bg-blue-50 text-blue-600' :
                    entry.type === 'incident' ? 'bg-red-50 text-red-600' :
                    entry.type === 'login' ? 'bg-purple-50 text-purple-600' :
                    'bg-teal-50 text-teal-600'
                  }`}>
                    {entry.type === 'medication' ? '💊' :
                     entry.type === 'incident' ? '⚠️' :
                     entry.type === 'login' ? '🔑' : '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700">{entry.action}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">{entry.user}</span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-[10px] text-slate-400">{entry.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Agency Alerts - Phase 8 */}
        {activeTab === 'alerts' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm text-slate-800">Agency Alerts</h3>
              <span className="text-[10px] text-slate-500">{alerts.length} active</span>
            </div>
            
            <div className="flex flex-col gap-2">
              {alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className="bg-white rounded-xl p-3 border shadow-sm"
                  style={{ 
                    borderColor: alert.severity === 'high' ? 'rgba(255,90,95,0.3)' : 
                                alert.severity === 'medium' ? 'rgba(246,183,60,0.3)' : 'rgba(0,0,0,0.08)',
                    background: alert.severity === 'high' ? 'rgba(255,90,95,0.03)' :
                                alert.severity === 'medium' ? 'rgba(246,183,60,0.03)' : 'white'
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        alert.severity === 'high' ? 'bg-red-500' :
                        alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                      <span className="font-semibold text-sm text-slate-800">{alert.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{alert.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-600">{alert.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium uppercase ${
                      alert.severity === 'high' ? 'bg-red-100 text-red-600' :
                      alert.severity === 'medium' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
