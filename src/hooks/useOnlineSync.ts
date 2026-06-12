import { useEffect, useCallback } from 'react'
import { getQueue, removeFromQueue, retryItem } from '../utils/offlineQueue'
import { saveVisit, sendSOS, logMedication, saveVoiceMemo } from '../api/client'

export function useOnlineSync() {
  const sync = useCallback(async () => {
    if (!navigator.onLine) return
    const items = await getQueue()
    for (const item of items) {
      if (item.retries > 3) continue
      try {
        if (item.type === 'visit') {
          await saveVisit((item.payload as any).visitId, item.payload)
        } else if (item.type === 'sos') {
          await sendSOS(item.payload as any)
        } else if (item.type === 'medication-log') {
          await logMedication(item.payload as any)
        } else if (item.type === 'voice-memo') {
          await saveVoiceMemo(item.payload as any)
        }
        await removeFromQueue(item.id!)
      } catch {
        await retryItem(item.id!)
      }
    }
  }, [])

  useEffect(() => {
    sync()
    const handler = () => { if (navigator.onLine) sync() }
    window.addEventListener('online', handler)
    const interval = setInterval(sync, 30000)
    return () => {
      window.removeEventListener('online', handler)
      clearInterval(interval)
    }
  }, [sync])
}
