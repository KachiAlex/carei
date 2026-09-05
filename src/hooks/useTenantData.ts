import { useState, useEffect, useCallback } from 'react'
import { useTenant } from '../contexts/TenantContext'
import * as api from '../api/client'

// Generic hook for tenant-aware data fetching
export function useTenantQuery<T>(
  queryFn: () => Promise<T>,
  deps: React.DependencyList = []
) {
  const { currentTenant, isLoading: tenantLoading } = useTenant()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (tenantLoading || !currentTenant) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await queryFn()
      setData(result)
    } catch (err: any) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [tenantLoading, currentTenant, queryFn])

  useEffect(() => {
    refetch()
  }, [refetch, ...deps])

  return { data, loading, error, refetch }
}

// Hook for fetching clients in current tenant
export function useTenantClients() {
  const { currentTenant } = useTenant()

  return useTenantQuery(
    useCallback(async () => {
      return api.getClients()
    }, []),
    [currentTenant?.id]
  )
}

// Hook for fetching carers in current tenant
export function useTenantCarers() {
  const { currentTenant } = useTenant()

  return useTenantQuery(
    useCallback(async () => {
      return api.getCarers()
    }, []),
    [currentTenant?.id]
  )
}

// Hook for fetching visits in current tenant
export function useTenantVisits() {
  const { currentTenant } = useTenant()

  return useTenantQuery(
    useCallback(async () => {
      return api.getVisits()
    }, []),
    [currentTenant?.id]
  )
}

// Hook for fetching scheduled visits
export function useScheduledVisits(from?: string, to?: string) {
  const { currentTenant } = useTenant()

  return useTenantQuery(
    useCallback(async () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const query = params.toString()
      const res = await fetch(`/api/schedule${query ? `?${query}` : ''}`, {
        headers: api.authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch schedule')
      return res.json()
    }, [from, to]),
    [currentTenant?.id, from, to]
  )
}

// Hook for fetching task logs for a client
export function useTaskLogs(clientId: string | null) {
  const { currentTenant } = useTenant()

  return useTenantQuery(
    useCallback(async () => {
      if (!clientId) return null
      const res = await fetch(`/api/tasks/log?clientId=${clientId}`, {
        headers: api.authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch task logs')
      return res.json()
    }, [clientId]),
    [currentTenant?.id, clientId]
  )
}

// Hook for fetching incidents for a visit
export function useVisitIncidents(visitId: string | null) {
  const { currentTenant } = useTenant()

  return useTenantQuery(
    useCallback(async () => {
      if (!visitId) return null
      const res = await fetch(`/api/incidents?visitId=${visitId}`, {
        headers: api.authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch incidents')
      return res.json()
    }, [visitId]),
    [currentTenant?.id, visitId]
  )
}

// Hook for fetching body map marks
export function useBodyMapMarks(visitId: string | null) {
  const { currentTenant } = useTenant()

  return useTenantQuery(
    useCallback(async () => {
      if (!visitId) return null
      const res = await fetch(`/api/body-map?visitId=${visitId}`, {
        headers: api.authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch body map marks')
      return res.json()
    }, [visitId]),
    [currentTenant?.id, visitId]
  )
}

// Hook for fetching invites for current tenant (admin only)
export function useTenantInvites() {
  const { currentTenant } = useTenant()
  const currentUserRole = currentTenant?.role

  return useTenantQuery(
    useCallback(async () => {
      if (!currentTenant?.slug || currentUserRole !== 'admin') return null
      const res = await fetch(`/api/invites?tenantSlug=${currentTenant.slug}`, {
        headers: api.authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch invites')
      return res.json()
    }, [currentTenant?.slug, currentUserRole]),
    [currentTenant?.slug, currentUserRole]
  )
}

// Hook for creating an invite (admin only)
export function useCreateInvite() {
  const { currentTenant } = useTenant()
  const currentUserRole = currentTenant?.role

  const createInvite = useCallback(
    async (email: string, role: string = 'carer', expiresInHours: number = 48) => {
      if (!currentTenant?.id || currentUserRole !== 'admin') {
        throw new Error('Admin access required')
      }

      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: api.authHeaders(),
        body: JSON.stringify({
          tenantId: currentTenant.id,
          email,
          role,
          expiresInHours,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create invite')
      }

      return res.json()
    },
    [currentTenant?.id, currentUserRole]
  )

  return { createInvite, canInvite: currentUserRole === 'admin' }
}

// Hook for cancelling an invite (admin only)
export function useCancelInvite() {
  const { currentTenant } = useTenant()
  const currentUserRole = currentTenant?.role

  const cancelInvite = useCallback(
    async (inviteId: string) => {
      if (currentUserRole !== 'admin') {
        throw new Error('Admin access required')
      }

      const res = await fetch(`/api/invites?id=${inviteId}`, {
        method: 'DELETE',
        headers: api.authHeaders(),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to cancel invite')
      }

      return res.json()
    },
    [currentUserRole]
  )

  return { cancelInvite, canCancel: currentUserRole === 'admin' }
}
