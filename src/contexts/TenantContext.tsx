import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useRoute, useLocation } from 'wouter'
import { API_BASE } from '../api/client'
import { getToken, clearAuthCache } from '../utils/tokenCache'

interface Tenant {
  id: string
  slug: string
  name: string
  role: string
  settings?: Record<string, unknown>
}

interface TenantContextType {
  currentTenant: Tenant | null
  tenants: Tenant[]
  isLoading: boolean
  error: string | null
  setCurrentTenant: (tenant: Tenant) => void
  refreshTenants: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matchTenant, paramsTenant] = useRoute('/tenant/:slug/*')
  const [, setLocation] = useLocation()

  // Extract tenant slug from URL
  const urlTenantSlug = matchTenant ? paramsTenant?.slug : null

  // Load user's tenants — prefer /auth/me (returns user + tenants in one call)
  // and fall back to /tenants for explicit refresh or if /auth/me fails
  const refreshTenants = async (forceFresh = false) => {
    const token = getToken()
    if (!token) {
      setTenants([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      let userTenants: Tenant[] = []

      if (!forceFresh) {
        // Try /auth/me first — it returns tenants along with user profile
        try {
          const meRes = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (meRes.ok) {
            const meData = await meRes.json()
            userTenants = meData.tenants || []
          }
        } catch { /* fall through to /tenants */ }
      }

      // If /auth/me didn't return tenants or forceFresh is true, call /tenants
      if (userTenants.length === 0) {
        const res = await fetch(`${API_BASE}/tenants`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!res.ok) {
          if (res.status === 401) {
            clearAuthCache()
            setTenants([])
            setCurrentTenantState(null)
          }
          throw new Error('Failed to fetch tenants')
        }

        const data = await res.json()
        userTenants = data.tenants || []
      }

      setTenants(userTenants)

      // If URL has tenant slug, validate and set it
      if (urlTenantSlug) {
        const urlTenant = userTenants.find(t => t.slug === urlTenantSlug)
        if (urlTenant) {
          setCurrentTenantState(urlTenant)
          localStorage.setItem('carei_current_tenant', JSON.stringify(urlTenant))
        } else if (userTenants.length > 0) {
          // Invalid tenant in URL, redirect to first available
          setLocation(`/tenant/${userTenants[0].slug}/dashboard`)
        }
      } else {
        // No tenant in URL, try to restore from localStorage
        const savedTenant = localStorage.getItem('carei_current_tenant')
        if (savedTenant) {
          const parsed = JSON.parse(savedTenant)
          const validTenant = userTenants.find(t => t.id === parsed.id)
          if (validTenant) {
            setCurrentTenantState(validTenant)
            // Redirect to tenant-specific URL
            const currentPath = window.location.pathname
            if (currentPath === '/login' || currentPath === '/') {
              setLocation(`/tenant/${validTenant.slug}/dashboard`)
            }
          } else if (userTenants.length > 0) {
            setCurrentTenantState(userTenants[0])
            localStorage.setItem('carei_current_tenant', JSON.stringify(userTenants[0]))
          }
        } else if (userTenants.length > 0) {
          setCurrentTenantState(userTenants[0])
          localStorage.setItem('carei_current_tenant', JSON.stringify(userTenants[0]))
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshTenants()
  }, [urlTenantSlug])

  const setCurrentTenant = (tenant: Tenant) => {
    setCurrentTenantState(tenant)
    localStorage.setItem('carei_current_tenant', JSON.stringify(tenant))
    setLocation(`/tenant/${tenant.slug}/dashboard`)
  }

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        tenants,
        isLoading,
        error,
        setCurrentTenant,
        refreshTenants
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

export function useTenantHeader() {
  const { currentTenant } = useTenant()
  return currentTenant ? { 'X-Tenant-Slug': currentTenant.slug } : {}
}
