import { useState, useEffect, useMemo } from 'react'
import { useLocation, useSearch } from 'wouter'
import { getMe, getAllTenantsAdmin, updateTenantPlan, updateTenantActive, updateTenantPrice, deleteTenant, createTenant, getPlans, updatePlan, createPlan, deletePlan } from '../api/client'
import { getToken, setToken, clearAuthCache } from '../utils/tokenCache'
import { secureGet, secureRemove } from '../utils/secureStorage'

interface Plan {
  id: string
  slug: string
  name: string
  max_users: number
  max_clients: number
  price_per_carer: number
  billing_model: string
  is_default: boolean
}

interface Tenant {
  id: string
  slug: string
  name: string
  plan: string
  active: boolean
  max_users: number
  max_clients: number
  subscription_status: string
  price_per_carer: number | null
  billing_model: string
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
    estimatedMrr: 0,
  })
  const [plans, setPlans] = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansError, setPlansError] = useState<string | null>(null)

  const search = useSearch()
  const activeTab = useMemo(() => {
    const params = new URLSearchParams(search)
    return (params.get('tab') as 'dashboard' | 'organizations' | 'licensing' | 'plans') || 'dashboard'
  }, [search])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if ((activeTab === 'plans' || activeTab === 'organizations' || activeTab === 'licensing') && plans.length === 0) {
      loadPlans()
    }
  }, [activeTab])

  const loadData = async () => {
    let token = getToken()
    if (!token) {
      token = await secureGet('token')
      if (token) setToken(token)
    }
    if (!token) {
      setLocation('/login?redirect=/super-admin')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const meRes = await getMe() as any
      if (!meRes?.user || meRes.user.role !== 'superadmin') {
        setLocation('/login?redirect=/super-admin')
        return
      }

      const data = await getAllTenantsAdmin()
      const tenantList: Tenant[] = data.tenants || []
      setTenants(tenantList)

      const activeTenants = tenantList.filter(t => t.active)
      const estimatedMrr = activeTenants.reduce((acc, t) => {
        const price = t.price_per_carer ?? 0
        return acc + (price * (t.user_count || 0))
      }, 0)
      setStats({
        totalTenants: tenantList.length,
        totalUsers: tenantList.reduce((acc, t) => acc + (t.user_count || 0), 0),
        activeToday: activeTenants.length,
        totalClients: tenantList.reduce((acc, t) => acc + (t.client_count || 0), 0),
        totalVisits: tenantList.reduce((acc, t) => acc + (t.visit_count || 0), 0),
        estimatedMrr,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPlans = async () => {
    setPlansLoading(true)
    setPlansError(null)
    try {
      const data = await getPlans() as any
      setPlans(data.plans || [])
    } catch (err: any) {
      setPlansError(err.message)
    } finally {
      setPlansLoading(false)
    }
  }

  const handlePlanUpdate = async (idx: number, field: keyof Plan, value: string | number) => {
    const updated = [...plans]
    updated[idx] = { ...updated[idx], [field]: value } as Plan
    setPlans(updated)
  }

  const handlePlanSave = async (idx: number) => {
    setPlansError(null)
    try {
      const plan = plans[idx]
      await updatePlan({
        slug: plan.slug,
        name: plan.name,
        max_users: Number(plan.max_users),
        max_clients: Number(plan.max_clients),
        price_per_carer: Number(plan.price_per_carer),
        billing_model: plan.billing_model,
      })
      await loadPlans()
    } catch (err: any) {
      setPlansError(err.message)
    }
  }

  const [showAddPlanModal, setShowAddPlanModal] = useState(false)
  const [newPlanForm, setNewPlanForm] = useState({
    slug: '',
    name: '',
    max_users: 10,
    max_clients: 20,
    price_per_carer: 10,
    billing_model: 'per-carer',
  })
  const [addPlanLoading, setAddPlanLoading] = useState(false)

  const handlePlanCreate = async () => {
    setPlansError(null)
    setAddPlanLoading(true)
    try {
      await createPlan({
        slug: newPlanForm.slug.toLowerCase().replace(/\s+/g, '-'),
        name: newPlanForm.name,
        max_users: Number(newPlanForm.max_users),
        max_clients: Number(newPlanForm.max_clients),
        price_per_carer: Number(newPlanForm.price_per_carer),
        billing_model: newPlanForm.billing_model,
      })
      setShowAddPlanModal(false)
      setNewPlanForm({ slug: '', name: '', max_users: 10, max_clients: 20, price_per_carer: 10, billing_model: 'per-carer' })
      await loadPlans()
    } catch (err: any) {
      setPlansError(err.message)
    } finally {
      setAddPlanLoading(false)
    }
  }

  const handlePlanDelete = async (slug: string) => {
    setPlansError(null)
    if (!confirm(`Delete plan "${slug}"? This cannot be undone.`)) return
    try {
      await deletePlan(slug)
      await loadPlans()
    } catch (err: any) {
      setPlansError(err.message)
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

  const handlePriceChange = async (slug: string, price: number) => {
    if (price < 0) return
    setActionError(null)
    try {
      await updateTenantPrice(slug, price)
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
    <div className="min-h-screen flex" style={{ background: '#0B1120' }}>
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/80 border-r border-white/10 hidden md:flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation('/')}
              className="bg-transparent border-none cursor-pointer transition-transform hover:scale-105"
              title="Go to home"
            >
              <img src="/logo.jpg" alt="CAREi" width="40" height="40" className="rounded-xl" style={{ objectFit: 'cover' }} />
            </button>
            <div>
              <h1 className="font-bold text-white text-sm">CAREi</h1>
              <p className="text-white/40 text-xs">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { label: 'Dashboard', tab: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
            { label: 'Organizations', tab: 'organizations', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
            { label: 'Licensing', tab: 'licensing', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { label: 'Plans', tab: 'plans', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => setLocation(`/super-admin?tab=${item.tab}`)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left bg-transparent border-none cursor-pointer transition-colors ${
                activeTab === item.tab
                  ? 'bg-teal-500/15 text-teal-400'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left bg-transparent border-none cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-auto">
        <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'dashboard' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-8">
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
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-emerald-400 mb-1">£{stats.estimatedMrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div className="text-white/50 text-sm">Est. MRR</div>
          </div>
        </div>
          </>
        )}

        {activeTab === 'licensing' && (
          <>
            {/* Licensing — driven by actual plans from database */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">Per-Carer Licensing Structure</h3>
                <span className="text-white/40 text-xs">Synced with Plans configuration</span>
              </div>
              {plansError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm">{plansError}</p>
                </div>
              )}
              {plansLoading ? (
                <div className="text-white/50 text-sm">Loading plans...</div>
              ) : plans.length === 0 ? (
                <div className="text-white/50 text-sm">No plans configured. Go to the Plans tab to create one.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    {plans.map((plan, idx) => {
                      const isCustom = plan.billing_model === 'custom' || Number(plan.price_per_carer) === 0
                      const priceDisplay = isCustom ? 'Custom' : `£${plan.price_per_carer}`
                      const carerRange = plan.max_users >= 100 ? `${plan.max_users}+` : `1-${plan.max_users}`
                      return (
                        <div key={plan.slug} className="rounded-lg p-3 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div className="text-white font-medium text-sm">{plan.name}</div>
                          <div className="text-teal-400 font-bold text-lg">
                            {priceDisplay}
                            {!isCustom && <span className="text-white/40 text-xs font-normal">/carer/mo</span>}
                          </div>
                          <div className="text-white/40 text-xs">Up to {carerRange} carers</div>
                          <div className="text-white/40 text-xs">Up to {plan.max_clients} clients</div>
                          <div className="text-white/30 text-[10px] mt-0.5">
                            {plan.billing_model === 'per-carer' ? 'Per-carer billing' : plan.billing_model === 'flat' ? 'Flat rate' : 'Custom negotiation'}
                          </div>
                          {plan.is_default && <div className="text-teal-400 text-[10px] mt-1">Default plan</div>}
                        </div>
                      )
                    })}
                  </div>

                  {/* Quick price editor */}
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <h4 className="text-white/70 text-sm font-medium mb-3">Quick Price Editor</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-white/40 text-xs uppercase">
                          <tr>
                            <th className="px-3 py-2">Plan</th>
                            <th className="px-3 py-2">Price / Carer (£)</th>
                            <th className="px-3 py-2">Billing Model</th>
                            <th className="px-3 py-2">Max Carers</th>
                            <th className="px-3 py-2">Max Clients</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {plans.map((plan, idx) => (
                            <tr key={plan.slug} className="hover:bg-white/5 transition-colors">
                              <td className="px-3 py-2 text-white">{plan.name}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={plan.price_per_carer}
                                  onChange={(e) => handlePlanUpdate(idx, 'price_per_carer', e.target.value)}
                                  className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-teal-400"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={plan.billing_model}
                                  onChange={(e) => handlePlanUpdate(idx, 'billing_model', e.target.value)}
                                  className="bg-slate-800 text-white text-xs rounded px-2 py-1 border border-white/10 outline-none"
                                >
                                  <option value="per-carer">Per Carer</option>
                                  <option value="flat">Flat Rate</option>
                                  <option value="custom">Custom</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={plan.max_users}
                                  onChange={(e) => handlePlanUpdate(idx, 'max_users', e.target.value)}
                                  className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-teal-400"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={plan.max_clients}
                                  onChange={(e) => handlePlanUpdate(idx, 'max_clients', e.target.value)}
                                  className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-teal-400"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => handlePlanSave(idx)}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-teal-500 text-slate-900 hover:bg-teal-400 transition-colors font-medium"
                                >
                                  Save
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MRR Summary */}
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <h4 className="text-white/70 text-sm font-medium mb-3">Estimated Monthly Revenue</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg p-3 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="text-white/40 text-xs">Active Organizations</div>
                        <div className="text-white font-bold text-xl">{stats.totalTenants}</div>
                      </div>
                      <div className="rounded-lg p-3 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="text-white/40 text-xs">Total Carers</div>
                        <div className="text-white font-bold text-xl">{stats.totalUsers}</div>
                      </div>
                      <div className="rounded-lg p-3 border border-white/5" style={{ background: 'rgba(14,207,176,0.08)' }}>
                        <div className="text-white/40 text-xs">Est. MRR</div>
                        <div className="text-teal-400 font-bold text-xl">£{stats.estimatedMrr.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'plans' && (
          <>
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Configure Plans</h2>
                <button
                  onClick={() => { setShowAddPlanModal(true); setPlansError(null) }}
                  className="text-sm px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-colors flex items-center gap-1.5"
                >
                  <span>+</span> Add Plan
                </button>
              </div>
              {plansError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm">{plansError}</p>
                </div>
              )}
              {plansLoading ? (
                <div className="text-white/50 text-sm">Loading plans...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-white/50 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2">Plan Name</th>
                        <th className="px-4 py-2">Slug</th>
                        <th className="px-4 py-2">Max Users</th>
                        <th className="px-4 py-2">Max Clients</th>
                        <th className="px-4 py-2">Price / Carer (£)</th>
                        <th className="px-4 py-2">Billing Model</th>
                        <th className="px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {plans.map((plan, idx) => (
                        <tr key={plan.slug} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={plan.name}
                              onChange={(e) => handlePlanUpdate(idx, 'name', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-teal-400"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-white/50 text-xs font-mono">{plan.slug}</span>
                            {plan.is_default && <span className="ml-2 text-xs text-teal-400">(default)</span>}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={1}
                              value={plan.max_users}
                              onChange={(e) => handlePlanUpdate(idx, 'max_users', e.target.value)}
                              className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-teal-400"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={1}
                              value={plan.max_clients}
                              onChange={(e) => handlePlanUpdate(idx, 'max_clients', e.target.value)}
                              className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-teal-400"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={plan.price_per_carer}
                              onChange={(e) => handlePlanUpdate(idx, 'price_per_carer', e.target.value)}
                              className="w-28 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-teal-400"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={plan.billing_model}
                              onChange={(e) => handlePlanUpdate(idx, 'billing_model', e.target.value)}
                              className="bg-slate-800 text-white text-xs rounded px-2 py-1 border border-white/10 outline-none"
                            >
                              <option value="per-carer">Per Carer</option>
                              <option value="flat">Flat Rate</option>
                              <option value="custom">Custom</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handlePlanSave(idx)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-teal-500 text-slate-900 hover:bg-teal-400 transition-colors font-medium"
                              >
                                Save
                              </button>
                              {!plan.is_default && (
                                <button
                                  onClick={() => handlePlanDelete(plan.slug)}
                                  className="text-xs px-2 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors font-medium"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Plan Modal */}
              {showAddPlanModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                  <div className="bg-slate-900 rounded-xl border border-white/10 p-6 w-full max-w-md">
                    <h3 className="text-white font-semibold mb-4">Add New Plan</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-white/50 text-xs block mb-1">Plan Name</label>
                        <input
                          type="text"
                          value={newPlanForm.name}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, name: e.target.value })}
                          placeholder="e.g. Premium"
                          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-teal-400"
                        />
                      </div>
                      <div>
                        <label className="text-white/50 text-xs block mb-1">Slug (unique identifier)</label>
                        <input
                          type="text"
                          value={newPlanForm.slug}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                          placeholder="e.g. premium"
                          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-teal-400 font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-white/50 text-xs block mb-1">Max Users</label>
                          <input
                            type="number"
                            min={1}
                            value={newPlanForm.max_users}
                            onChange={(e) => setNewPlanForm({ ...newPlanForm, max_users: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-teal-400"
                          />
                        </div>
                        <div>
                          <label className="text-white/50 text-xs block mb-1">Max Clients</label>
                          <input
                            type="number"
                            min={1}
                            value={newPlanForm.max_clients}
                            onChange={(e) => setNewPlanForm({ ...newPlanForm, max_clients: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-teal-400"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-white/50 text-xs block mb-1">Price / Carer (£)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={newPlanForm.price_per_carer}
                            onChange={(e) => setNewPlanForm({ ...newPlanForm, price_per_carer: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-teal-400"
                          />
                        </div>
                        <div>
                          <label className="text-white/50 text-xs block mb-1">Billing Model</label>
                          <select
                            value={newPlanForm.billing_model}
                            onChange={(e) => setNewPlanForm({ ...newPlanForm, billing_model: e.target.value })}
                            className="w-full bg-slate-800 text-white text-sm rounded px-3 py-2 border border-white/10 outline-none"
                          >
                            <option value="per-carer">Per Carer</option>
                            <option value="flat">Flat Rate</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 mt-6">
                      <button
                        onClick={() => setShowAddPlanModal(false)}
                        className="text-sm px-4 py-2 rounded-lg text-white/60 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePlanCreate}
                        disabled={!newPlanForm.name || !newPlanForm.slug || addPlanLoading}
                        className="text-sm px-4 py-2 rounded-lg bg-teal-500 text-slate-900 hover:bg-teal-400 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {addPlanLoading ? 'Creating...' : 'Create Plan'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'organizations' && (
          <>
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
                  <th className="px-4 py-2">Price / Carer</th>
                  <th className="px-4 py-2">Est. Monthly</th>
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
                        {plans.map((p) => (
                          <option key={p.slug} value={p.slug}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {tenant.user_count} / {tenant.max_users}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-white/40 text-xs">£</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          defaultValue={tenant.price_per_carer ?? ''}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value)
                            if (!isNaN(val) && val !== (tenant.price_per_carer ?? 0)) {
                              handlePriceChange(tenant.slug, val)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = parseFloat((e.target as HTMLInputElement).value)
                              if (!isNaN(val) && val !== (tenant.price_per_carer ?? 0)) {
                                handlePriceChange(tenant.slug, val)
                              }
                            }
                          }}
                          className="w-16 bg-slate-800 text-white text-xs rounded px-2 py-1 border border-white/10 outline-none focus:border-teal-400"
                          placeholder="—"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-400 font-medium">
                        {tenant.price_per_carer ? `£${(tenant.price_per_carer * tenant.user_count).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </span>
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
          </>
        )}

        {activeTab === 'dashboard' && (
          <>
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
          </>
        )}

        {/* Add Tenant Modal */}
        {activeTab === 'organizations' && showAddModal && (
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
                    {plans.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name} ({p.max_users} users, {p.max_clients} clients)</option>
                    ))}
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
      </main>
    </div>
  </div>
  )
}
