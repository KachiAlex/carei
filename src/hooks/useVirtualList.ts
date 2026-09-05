import { useState, useCallback, useRef, useEffect } from 'react'

interface UseVirtualListOptions {
  itemHeight: number
  overscan?: number
}

interface VirtualItem<T> {
  index: number
  item: T
  style: React.CSSProperties
}

export function useVirtualList<T>(items: T[], options: UseVirtualListOptions) {
  const { itemHeight, overscan = 3 } = options
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const totalHeight = items.length * itemHeight

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + (containerRef.current?.clientHeight || 600)) / itemHeight) + overscan
  )

  const virtualItems: VirtualItem<T>[] = []
  for (let i = startIndex; i <= endIndex; i++) {
    if (i >= 0 && i < items.length) {
      virtualItems.push({
        index: i,
        item: items[i],
        style: {
          position: 'absolute',
          top: i * itemHeight,
          height: itemHeight,
          left: 0,
          right: 0,
        },
      })
    }
  }

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Update scrollTop on resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setScrollTop(el.scrollTop))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return {
    containerRef,
    virtualItems,
    totalHeight,
    onScroll,
    startIndex,
    endIndex,
  }
}
