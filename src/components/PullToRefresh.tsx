import React from 'react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

interface Props {
  onRefresh: () => void | Promise<void>
  children: React.ReactNode
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const { containerRef, pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(onRefresh)

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
    >
      {pullDistance > 0 && (
        <div
          className="absolute left-0 right-0 flex items-center justify-center text-xs font-medium text-teal z-10 transition-all"
          style={{
            top: -Math.min(pullDistance, 60),
            height: Math.min(pullDistance, 60),
            opacity: pullDistance >= 80 ? 1 : pullDistance / 80,
          }}
        >
          {refreshing ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
              </svg>
              Refreshing…
            </span>
          ) : (
            <span>{pullDistance >= 80 ? 'Release to refresh' : 'Pull to refresh'}</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
