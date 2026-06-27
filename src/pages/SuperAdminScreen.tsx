import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { getMe, getAllTenantsAdmin, updateTenantPlan, updateTenantActive, deleteTenant, createTenant } from '../api/client'
import { getToken, setToken, clearAuthCache } from '../utils/tokenCache'
import { secureGet, secureRemove } from '../utils/secureStorage'

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
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '',
    slug: '',
    domain: '',
    plan: 'trial',
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    managerRegion: '',
    managerPin: '',
  })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
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
    let token = getToken()
    if (!token) {
      token = await secureGet('token')
      if (token) setToken(token)
    }
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

  const handleLogout = async () => {
    clearAuthCache()
    await secureRemove('token')
    await secureRemove('user')
    localStorage.removeItem('carei_current_tenant')
    setLocation('/login')
  }

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    if (!addForm.name.trim() || !addForm.slug.trim()) {
      setAddError('Organization name and slug are required')
      return
    }
    if (!/^[a-z0-9-]+$/.test(addForm.slug)) {
      setAddError('Slug must be lowercase alphanumeric with hyphens only')
      return
    }
    if (!addForm.managerName.trim() || !addForm.managerEmail.trim()) {
      setAddError('Manager name and email are required')
      return
    }
    setAddLoading(true)
    try {
      await createTenant({
        slug: addForm.slug.trim(),
        name: addForm.name.trim(),
        domain: addForm.domain.trim() || undefined,
        plan: addForm.plan,
        manager: {
          name: addForm.managerName.trim(),
          email: addForm.managerEmail.trim(),
          phone: addForm.managerPhone.trim() || undefined,
          region: addForm.managerRegion.trim() || undefined,
          pin: addForm.managerPin.trim() || undefined,
          role: 'admin',
        },
      })
      setShowAddModal(false)
      setAddForm({
        name: '',
        slug: '',
        domain: '',
        plan: 'trial',
        managerName: '',
        managerEmail: '',
        managerPhone: '',
        managerRegion: '',
        managerPin: '',
      })
      await loadData()
    } catch (err: any) {
      setAddError(err.message)
    } finally {
      setAddLoading(false)
    }
  }

  const autoSlug = (name: string) => {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
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
            <button
              onClick={() => { setShowAddModal(true); setAddError(null) }}
              className="text-sm px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-colors flex items-center gap-1.5"
            >
              <span>+</span> Add Organization
            </button>
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

        {/* Add Tenant Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-900 rounded-xl border border-white/10 w-full max-w-md p-4 sm:p-6 my-auto max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Add Organization</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-white/40 hover:text-white text-xl leading-none"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleAddTenant} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Organization Name *</label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => {
                      const name = e.target.value
                      setAddForm(prev => ({
                        ...prev,
                        name,
                        slug: prev.slug || autoSlug(name),
                      }))
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-400/50"
                    placeholder="Acme Care"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Slug *</label>
                  <input
                    type="text"
                    value={addForm.slug}
                    onChange={(e) => setAddForm(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-400/50"
                    placeholder="acme-care"
                    required
                  />
                  <p className="text-white/30 text-xs mt-1">Lowercase alphanumeric with hyphens only</p>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Domain (optional)</label>
                  <input
                    type="text"
                    value={addForm.domain}
                    onChange={(e) => setAddForm(prev => ({ ...prev, domain: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-400/50"
                    placeholder="acme-care.com"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-1">Plan</label>
                  <select
                    value={addForm.plan}
                    onChange={(e) => setAddForm(prev => ({ ...prev, plan: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-400/50"
                  >
                    <option value="trial">Trial (3 users, 10 clients)</option>
                    <option value="professional">Professional (15 users, 100 clients)</option>
                    <option value="enterprise">Enterprise (100 users, 500 clients)</option>
                  </select>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-sm font-medium text-teal-400 mb-3">Manager Account</h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Manager Name *</label>
                      <input
                        type="text"
                        value={addForm.managerName}
                        onChange={(e) => setAddForm(prev => ({ ...prev, managerName: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-400/50"
                        placeholder="John Doe"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-white/60 mb-1">Manager Email *</label>
                      <input
                        type="email"
                        value={addForm.managerEmail}
                        onChange={(e) => setAddForm(prev => ({ ...prev, managerEmail: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-400/50"
                        placeholder="john@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-white/60 mb-1">Phone</label>
                      <input
                        type="text"
                        value={addForm.managerPhone}
                        onChange={(e) => setAddForm(prev => ({ ...prev, managerPhone: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-400/50"
                        placeholder="+1 234 567 8900"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-white/60 mb-1">Region</label>
                        <input
                          type="text"
                          value={addForm.managerRegion}
                          onChange={(e) => setAddForm(prev => ({ ...prev, managerRegion: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-400/50"
                          placeholder="London"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/60 mb-1">PIN</label>
                        <input
                          type="text"
                          value={addForm.managerPin}
                          onChange={(e) => setAddForm(prev => ({ ...prev, managerPin: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-400/50"
                          placeholder="1234"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {addError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                    <p className="text-red-400 text-sm">{addError}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="flex-1 px-4 py-2 rounded-lg bg-teal-500 text-slate-900 hover:bg-teal-400 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {addLoading ? 'Creating...' : 'Create Organization'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
