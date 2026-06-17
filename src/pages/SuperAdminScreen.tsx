import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { getMe, getAllTenantsAdmin, updateTenantPlan, updateTenantActive, deleteTenant } from '../api/client'

interface Tenant {
  id: string
  slug: string
  name: string
  plan: string
  active: boolean
  max_users: number
  max_clients: number
  subscription_status: string
  user_count: number
  client_count: number
  visit_count: number
  created_at: string
}

export default function SuperAdminScreen() {
  const [, setLocation] = useLocation()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    activeToday: 0,
    totalClients: 0,
    totalVisits: 0,
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
      setError(null)

      const meRes = await getMe() as any
      if (!meRes?.user || meRes.user.role !== 'superadmin') {
        setLocation('/login')
        return
      }

      const data = await getAllTenantsAdmin()
      const tenantList: Tenant[] = data.tenants || []
      setTenants(tenantList)

      setStats({
        totalTenants: tenantList.length,
        totalUsers: tenantList.reduce((acc, t) => acc + (t.user_count || 0), 0),
        activeToday: tenantList.filter(t => t.active).length,
        totalClients: tenantList.reduce((acc, t) => acc + (t.client_count || 0), 0),
        totalVisits: tenantList.reduce((acc, t) => acc + (t.visit_count || 0), 0),
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlanChange = async (slug: string, newPlan: string) => {
    setActionError(null)
    try {
      await updateTenantPlan(slug, newPlan)
      await loadData()
    } catch (err: any) {
      setActionError(err.message)
    }
  }

  const handleToggleActive = async (slug: string, currentActive: boolean) => {
    setActionError(null)
    try {
      await updateTenantActive(slug, !currentActive)
      await loadData()
    } catch (err: any) {
      setActionError(err.message)
    }
  }

  const handleDelete = async (slug: string) => {
    if (!window.confirm(`Are you sure you want to delete tenant "${slug}"? This cannot be undone.`)) return
    setActionError(null)
    try {
      await deleteTenant(slug)
      await loadData()
    } catch (err: any) {
      setActionError(err.message)
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
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">{stats.totalTenants}</div>
            <div className="text-white/50 text-sm">Organizations</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-teal-400 mb-1">{stats.totalUsers}</div>
            <div className="text-white/50 text-sm">Total Users</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-purple-400 mb-1">{stats.totalClients}</div>
            <div className="text-white/50 text-sm">Clients</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-amber-400 mb-1">{stats.totalVisits}</div>
            <div className="text-white/50 text-sm">Visits</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-green-400 mb-1">{stats.activeToday}</div>
            <div className="text-white/50 text-sm">Active Tenants</div>
          </div>
        </div>

        {(error || actionError) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
            <p className="text-red-400 text-sm">{error || actionError}</p>
          </div>
        )}

        {/* Tenants Table */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-white">Organizations</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-white/50 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Users / Limit</th>
                  <th className="px-4 py-2">Clients</th>
                  <th className="px-4 py-2">Visits</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{tenant.name}</div>
                      <div className="text-white/30 text-xs">{new Date(tenant.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3 text-white/60">{tenant.slug}</td>
                    <td className="px-4 py-3">
                      <select
                        value={tenant.plan}
                        onChange={(e) => handlePlanChange(tenant.slug, e.target.value)}
                        className="bg-slate-800 text-white text-xs rounded px-2 py-1 border border-white/10 outline-none"
                      >
                        <option value="trial">Trial</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {tenant.user_count} / {tenant.max_users}
                    </td>
                    <td className="px-4 py-3 text-white/60">{tenant.client_count}</td>
                    <td className="px-4 py-3 text-white/60">{tenant.visit_count}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        tenant.active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tenant.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(tenant.slug, tenant.active)}
                          className="text-xs px-2 py-1 rounded bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          {tenant.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(tenant.slug)}
                          className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">API</span>
                <span className="text-teal-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Storage</span>
                <span className="text-white/40 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  N/A
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="font-medium text-white mb-2">Recent Activity</h3>
            <div className="space-y-2 text-sm">
              <div className="text-white/40">No recent activity</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
