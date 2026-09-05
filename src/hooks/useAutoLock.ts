import { useEffect, useRef, useCallback } from 'react'

const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const BACKGROUND_LOCK_MS = 30 * 1000   // 30 seconds

interface AutoLockOptions {
  onLock: () => void
  enabled?: boolean
}

export function useAutoLock({ onLock, enabled = true }: AutoLockOptions) {
  const lastActiveRef = useRef(Date.now())
  const backgroundedAtRef = useRef<number | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleIdleCheck = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (Date.now() - lastActiveRef.current >= IDLE_TIMEOUT_MS) {
        onLock()
      }
    }, IDLE_TIMEOUT_MS)
  }, [onLock])

  const resetIdle = useCallback(() => {
    lastActiveRef.current = Date.now()
    if (enabled) scheduleIdleCheck()
  }, [enabled, scheduleIdleCheck])

  useEffect(() => {
    if (!enabled) return

    const events = ['touchstart', 'mousedown', 'keydown', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }))
    scheduleIdleCheck()

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [enabled, resetIdle, scheduleIdleCheck])

  useEffect(() => {
    if (!enabled) return

    const handleVisibility = () => {
      if (document.hidden) {
        backgroundedAtRef.current = Date.now()
      } else {
        const bgAt = backgroundedAtRef.current
        backgroundedAtRef.current = null
        if (bgAt && Date.now() - bgAt >= BACKGROUND_LOCK_MS) {
          onLock()
        } else {
          resetIdle()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled, onLock, resetIdle])
}
