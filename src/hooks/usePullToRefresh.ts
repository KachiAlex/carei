import { useState, useCallback, useRef } from 'react'

const PULL_THRESHOLD = 80

export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const isAtTop = useCallback(() => {
    const el = containerRef.current
    if (!el) return false
    return el.scrollTop <= 0
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isAtTop() || refreshing) return
    startY.current = e.touches[0].clientY
    currentY.current = startY.current
    setPulling(true)
  }, [isAtTop, refreshing])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling) return
    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current
    if (diff > 0) {
      e.preventDefault()
      const damped = Math.min(diff * 0.5, PULL_THRESHOLD * 1.5)
      setPullDistance(damped)
    }
  }, [pulling])

  const onTouchEnd = useCallback(async () => {
    if (!pulling) return
    setPulling(false)
    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true)
      setPullDistance(PULL_THRESHOLD)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pulling, pullDistance, onRefresh])

  return {
    containerRef,
    pulling,
    pullDistance,
    refreshing,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
