import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { getMe } from '../api/client'

interface Tenant {
  id: string
  slug: string
  name: string
  plan: string
  created_at: string
  user_count?: number
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function SuperAdminScreen() {
  const [, setLocation] = useLocation()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    activeToday: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const token = localStorage.getItem('carei_token')
    if (!token) {
      setLocation('/login')
      return
    }

    try {
      setIsLoading(true)

      // Verify super admin role via /auth/me
      const meRes = await getMe() as any
      if (!meRes?.user || meRes.user.role !== 'superadmin') {
        setLocation('/login')
        return
      }

      // For now, fetch all tenants by making individual requests
      // In production, this would be a dedicated super admin endpoint
      const res = await fetch(`${API_URL}/tenants?admin=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.status === 401) {
        setLocation('/login')
        return
      }

      // This is a placeholder - real implementation needs a super admin API
      setTenants([
        { id: '1', slug: 'demo', name: 'Demo Organization', plan: 'professional', created_at: new Date().toISOString(), user_count: 5 },
        { id: '2', slug: 'sunrise', name: 'Sunrise Care', plan: 'enterprise', created_at: new Date().toISOString(), user_count: 12 },
      ])

      setStats({
        totalTenants: 2,
        totalUsers: 17,
        activeToday: 8
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('carei_token')
    localStorage.removeItem('carei_current_tenant')
    setLocation('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1120' }}>
        <div className="w-10 h-10 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0B1120' }}>
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-slate-900 font-bold text-lg">
              C
            </div>
            <div>
              <h1 className="font-bold text-white">Super Admin</h1>
              <p className="text-white/40 text-xs">Platform Management</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.totalTenants}</div>
            <div className="text-white/50 text-sm">Organizations</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-teal-400 mb-1">{stats.totalUsers}</div>
            <div className="text-white/50 text-sm">Total Users</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-purple-400 mb-1">{stats.activeToday}</div>
            <div className="text-white/50 text-sm">Active Today</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Tenants Table */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-white">Organizations</h2>
            <button className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 text-sm hover:bg-teal-500/30 transition-colors">
              + New Organization
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-lg">
                    🏥
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{tenant.name}</h3>
                    <p className="text-white/40 text-xs">carei.com/tenant/{tenant.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tenant.plan === 'enterprise'
                        ? 'bg-purple-500/20 text-purple-400'
                        : tenant.plan === 'professional'
                        ? 'bg-teal-500/20 text-teal-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {tenant.plan}
                    </span>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-white text-sm">{tenant.user_count} users</p>
                    <p className="text-white/40 text-xs">{new Date(tenant.created_at).toLocaleDateString()}</p>
                  </div>
                  <button className="p-2 text-white/40 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="font-medium text-white mb-2">System Health</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Database</span>
                <span className="text-teal-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">API</span>
                <span className="text-teal-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Storage</span>
                <span className="text-teal-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  12% used
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="font-medium text-white mb-2">Recent Activity</h3>
            <div className="space-y-2 text-sm">
              <div className="text-white/60">New user registered at Sunrise Care</div>
              <div className="text-white/60">Demo org upgraded to Professional</div>
              <div className="text-white/60">System backup completed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
