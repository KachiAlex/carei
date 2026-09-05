import { useEffect, useRef } from 'react'
import { getRetentionPolicy } from '../api/client'
import { getQueue, removeFromQueue } from '../utils/offlineQueue'

const LAST_PURGE_KEY = 'carei_last_local_purge'
const PURGE_CHECK_INTERVAL_MS = 5 * 60 * 1000 // Check every 5 minutes

interface RetentionPolicy {
  visitDraftRetentionDays?: number
  offlineQueueRetentionHours?: number
  autoPurgeEnabled?: boolean
}

export function useDataMinimisation() {
  const policyRef = useRef<RetentionPolicy | null>(null)

  useEffect(() => {
    let mounted = true
    let interval: ReturnType<typeof setInterval> | null = null

    async function init() {
      try {
        const policy: any = await getRetentionPolicy()
        if (!mounted || !policy) return
        policyRef.current = policy

        if (policy.autoPurgeEnabled !== false) {
          await purgeLocalData(policy)
          interval = setInterval(() => {
            if (policyRef.current?.autoPurgeEnabled !== false) {
              purgeLocalData(policyRef.current)
            }
          }, PURGE_CHECK_INTERVAL_MS)
        }
      } catch (err) {
        console.error('[DataMinimisation] Failed to load retention policy:', err)
      }
    }

    async function purgeLocalData(policy: RetentionPolicy | null) {
      const now = Date.now()
      const lastPurge = parseInt(localStorage.getItem(LAST_PURGE_KEY) || '0', 10)

      // Only purge once per hour to avoid excessive work
      if (now - lastPurge < 60 * 60 * 1000) return

      const queueRetentionHours = policy?.offlineQueueRetentionHours ?? 72
      const cutoff = now - queueRetentionHours * 60 * 60 * 1000

      try {
        // Purge stale items from the offline queue
        const items = await getQueue()
        let purgedCount = 0
        for (const item of items) {
          const createdAt = new Date(item.createdAt).getTime()
          if (createdAt < cutoff) {
            if (item.id != null) {
              await removeFromQueue(item.id)
              purgedCount++
            }
          }
        }

        // Purge stale localStorage cache keys (non-secure, non-auth)
        const cachePrefixes = ['carei_cache_', 'carei_client_cache_']
        const keysToDelete: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key) continue
          for (const prefix of cachePrefixes) {
            if (key.startsWith(prefix)) {
              const timestampStr = localStorage.getItem(key + '_ts')
              if (timestampStr) {
                const ts = parseInt(timestampStr, 10)
                if (ts < cutoff) {
                  keysToDelete.push(key)
                  keysToDelete.push(key + '_ts')
                }
              } else {
                // No timestamp — assume stale if older than retention
                keysToDelete.push(key)
              }
              break
            }
          }
        }
        keysToDelete.forEach((k) => localStorage.removeItem(k))

        // Purge stale IndexedDB data (drafts database)
        purgeStaleDrafts(policy?.visitDraftRetentionDays ?? 30)

        localStorage.setItem(LAST_PURGE_KEY, String(now))

        if (purgedCount > 0 || keysToDelete.length > 0) {
          console.log(`[DataMinimisation] Purged ${purgedCount} stale queue items, ${keysToDelete.length / 2} stale cache entries`)
        }
      } catch (err) {
        console.error('[DataMinimisation] Purge failed:', err)
      }
    }

    function purgeStaleDrafts(retentionDays: number) {
      try {
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
        const request = indexedDB.open('carei-drafts', 1)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('drafts')) {
            db.createObjectStore('drafts', { keyPath: 'visitId' })
          }
        }
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('drafts')) {
            db.close()
            return
          }
          const tx = db.transaction('drafts', 'readwrite')
          const store = tx.objectStore('drafts')
          const getAllReq = store.getAll()
          getAllReq.onsuccess = () => {
            const allDrafts = getAllReq.result || []
            for (const draft of allDrafts) {
              const updatedAt = draft.updatedAt || draft.savedAt || 0
              if (updatedAt < cutoff) {
                store.delete(draft.visitId)
              }
            }
          }
          tx.oncomplete = () => db.close()
        }
        request.onerror = () => {
          // Drafts DB may not exist — that's fine
        }
      } catch (err) {
        // IndexedDB may not be available — silently ignore
      }
    }

    init()

    return () => {
      mounted = false
      if (interval) clearInterval(interval)
    }
  }, [])
}
