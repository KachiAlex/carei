import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { API_BASE } from '../api/client'
import { getToken, setToken, getUser, clearAuthCache } from '../utils/tokenCache'
import { secureGet, secureRemove } from '../utils/secureStorage'

interface Tenant {
  id: string
  slug: string
  name: string
  role: string
}

export default function TenantSelectScreen() {
  const [, setLocation] = useLocation()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantSlug, setNewTenantSlug] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    let token = getToken()
    if (!token) {
      token = await secureGet('token')
      if (token) setToken(token)
    }
    if (!token) {
      setLocation('/login?redirect=/select-tenant')
      return
    }

    try {
      setIsLoading(true)
      const res = await fetch(`${API_BASE}/tenants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.status === 401) {
        clearAuthCache()
        secureRemove('token').catch(() => {})
        setLocation('/login')
        return
      }

      if (!res.ok) throw new Error('Failed to load organizations')

      const data = await res.json()
      setTenants(data.tenants || [])

      // If only one tenant, auto-redirect to the appropriate dashboard
      if (data.tenants?.length === 1) {
        localStorage.setItem('carei_current_tenant', JSON.stringify(data.tenants[0]))
        const userJson = getUser()
        const user = userJson ? JSON.parse(userJson) : null
        const isManager = user?.role === 'manager' || user?.role === 'admin'
        const path = isManager ? 'manager' : 'dashboard'
        setLocation(`/tenant/${data.tenants[0].slug}/${path}`)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const selectTenant = (tenant: Tenant) => {
    localStorage.setItem('carei_current_tenant', JSON.stringify(tenant))
    const userJson = getUser()
    const user = userJson ? JSON.parse(userJson) : null
    const isManager = user?.role === 'manager' || user?.role === 'admin'
    const path = isManager ? 'manager' : 'dashboard'
    setLocation(`/tenant/${tenant.slug}/${path}`)
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30)
  }

  const handleNameChange = (name: string) => {
    setNewTenantName(name)
    if (!newTenantSlug || newTenantSlug === generateSlug(newTenantName)) {
      setNewTenantSlug(generateSlug(name))
    }
  }

  const createTenant = async () => {
    if (!newTenantName.trim() || !newTenantSlug.trim()) return

    const token = getToken()
    if (!token) return

    try {
      setIsCreating(true)
      const res = await fetch(`${API_BASE}/tenants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newTenantName.trim(),
          slug: newTenantSlug.trim(),
          plan: 'trial'
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create organization')
      }

      const newTenant = await res.json()
      const tenant: Tenant = {
        id: newTenant.id,
        slug: newTenant.slug,
        name: newTenant.name,
        role: 'admin'
      }

      localStorage.setItem('carei_current_tenant', JSON.stringify(tenant))
      setLocation(`/tenant/${tenant.slug}/dashboard`)
    } catch (err: any) {
      setError(err.message)
      setIsCreating(false)
    }
  }

  const handleLogout = async () => {
    clearAuthCache()
    await secureRemove('token')
    await secureRemove('user')
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
    <div className="min-h-screen p-6" style={{ background: '#0B1120' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="text-4xl mb-2">🏥</div>
          <h1 className="text-2xl font-bold text-white mb-2">Select Organization</h1>
          <p className="text-white/60 text-sm">
            Choose which care organization to access
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Tenant List */}
        <div className="space-y-3 mb-6">
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => selectTenant(tenant)}
              className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-400/50 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white group-hover:text-teal-400 transition-colors">
                    {tenant.name}
                  </h3>
                  <p className="text-white/50 text-xs mt-0.5">carei.com/tenant/{tenant.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    tenant.role === 'admin'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-teal-500/20 text-teal-400'
                  }`}>
                    {tenant.role}
                  </span>
                  <svg className="w-5 h-5 text-white/30 group-hover:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        {tenants.length === 0 && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🏢</div>
            <p className="text-white/60 mb-4">You are not part of any organization yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-teal-500/20 text-teal-400 rounded-lg text-sm hover:bg-teal-500/30 transition-colors"
            >
              Create your first organization
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {tenants.length > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full p-3 rounded-xl border border-dashed border-white/20 text-white/60 hover:text-white hover:border-teal-400/50 hover:bg-white/5 transition-all text-sm"
            >
              + Create new organization
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full p-3 rounded-xl text-white/40 hover:text-white/60 transition-all text-sm"
          >
            Sign out
          </button>
        </div>
      </motion.div>

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-white/10"
          >
            <h2 className="text-xl font-bold text-white mb-1">Create Organization</h2>
            <p className="text-white/50 text-sm mb-4">Set up a new care organization</p>

            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Organization Name</label>
                <input
                  type="text"
                  value={newTenantName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Sunrise Care Home"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1.5 block">URL Slug</label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-white/30 text-sm">carei.com/tenant/</span>
                  <input
                    type="text"
                    value={newTenantSlug}
                    onChange={(e) => setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                  />
                </div>
                <p className="text-white/30 text-xs mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={createTenant}
                disabled={!newTenantName.trim() || !newTenantSlug.trim() || isCreating}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-teal-400 to-teal-500 text-slate-900 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
