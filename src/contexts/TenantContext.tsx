import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useRoute, useLocation } from 'wouter'

interface Tenant {
  id: string
  slug: string
  name: string
  role: string
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

const API_URL = import.meta.env.VITE_API_URL || '/api'

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matchTenant, paramsTenant] = useRoute('/tenant/:slug/*')
  const [, setLocation] = useLocation()

  // Extract tenant slug from URL
  const urlTenantSlug = matchTenant ? paramsTenant?.slug : null

  // Load user's tenants
  const refreshTenants = async () => {
    const token = localStorage.getItem('carei_token')
    if (!token) {
      setTenants([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const res = await fetch(`${API_URL}/tenants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('carei_token')
          setTenants([])
          setCurrentTenantState(null)
        }
        throw new Error('Failed to fetch tenants')
      }

      const data = await res.json()
      const userTenants: Tenant[] = data.tenants || []
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
