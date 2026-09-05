import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSyncStatus } from '../hooks/useOnlineSync'
import { getQueue } from '../utils/offlineQueue'

const COLORS = {
  teal: '#4FD1C5',
  amber: '#F6B73C',
  red: '#FF5A5F',
}

export default function SyncStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [syncState, setSyncState] = useState(getSyncStatus())
  const [queueLength, setQueueLength] = useState(0)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const interval = setInterval(async () => {
      setSyncState(getSyncStatus())
      const q = await getQueue()
      setQueueLength(q.length)
    }, 2000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  if (online && queueLength === 0 && !syncState.inProgress) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-3 border border-white/10 backdrop-blur-md"
        style={{ background: 'rgba(15, 29, 52, 0.9)' }}
      >
        {!online ? (
          <>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: COLORS.amber }} />
            <span className="text-xs font-bold text-white">Offline Mode</span>
            {queueLength > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] text-white/70">
                {queueLength} pending
              </span>
            )}
          </>
        ) : syncState.inProgress ? (
          <>
            <div className="w-4 h-4 border-2 border-teal border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-white">Syncing Data...</span>
          </>
        ) : queueLength > 0 ? (
          <>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: COLORS.teal }} />
            <span className="text-xs font-bold text-white">Connected • {queueLength} unsynced</span>
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  )
}
