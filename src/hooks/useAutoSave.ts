import { useEffect, useRef } from 'react'
import { saveVisitDraft } from '../api/client'

export function useAutoSave(visitId: string, data: unknown, delay = 3000) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visitId) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      saveVisitDraft(visitId, data).catch(() => {})
    }, delay)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [visitId, data, delay])
}
