import { useEffect, useCallback } from 'react'
import { getQueue, removeFromQueue, retryItem } from '../utils/offlineQueue'
import { 
  saveVisit, 
  sendSOS, 
  logMedication, 
  saveVoiceMemo, 
  reportIncident,
  saveBodyMapMark,
  sendFamilyMessage,
  updateVisitApproval,
  saveVisitDraft,
  completeTask,
  addTaskLog,
  startTask,
  updateClient,
  createClient,
  updateProfile,
  createCaregiver
} from '../api/client'

// Track sync status globally
let syncInProgress = false
let lastSyncTime: number | null = null
let syncError: string | null = null

export function getSyncStatus() {
  return {
    inProgress: syncInProgress,
    lastSync: lastSyncTime,
    error: syncError
  }
}

export function useOnlineSync() {
  const sync = useCallback(async () => {
    if (!navigator.onLine || syncInProgress) return
    
    syncInProgress = true
    syncError = null
    
    try {
      const items = await getQueue()
      let successCount = 0
      let failCount = 0
      
      for (const item of items) {
        // Skip items that have been retried too many times
        if (item.retries > 5) {
          console.warn(`[Sync] Skipping item ${item.id} - too many retries`)
          continue
        }
        
        try {
          console.log(`[Sync] Processing ${item.type}`, item.id)
          
          switch (item.type) {
            case 'visit':
              await saveVisit((item.payload as { visitId: string }).visitId, item.payload)
              break
              
            case 'sos':
              await sendSOS(item.payload as any)
              break
              
            case 'medication-log':
              await logMedication(item.payload as any)
              break
              
            case 'voice-memo':
              await saveVoiceMemo(item.payload as any)
              break
              
            case 'incident':
              await reportIncident(item.payload as any)
              break
              
            case 'body-map':
              await saveBodyMapMark(item.payload as any)
              break
              
            case 'family-message':
              const { clientId, message } = item.payload as { clientId: string; message: string }
              await sendFamilyMessage(clientId, message)
              break
              
            case 'visit-approval':
              await updateVisitApproval(item.payload as any)
              break
              
            case 'visit-draft':
              await saveVisitDraft((item.payload as any).visitId, item.payload)
              break
              
            case 'task-start':
              await startTask(item.payload as any)
              break
              
            case 'task-complete':
              await completeTask(item.payload as any)
              break
              
            case 'task-log':
              await addTaskLog(item.payload as any)
              break
              
            case 'client-update': {
              const { clientId, ...data } = item.payload as any
              await updateClient(clientId, data)
              break
            }
              
            case 'client-create':
              await createClient(item.payload as any)
              break
              
            case 'caregiver-update':
              await updateProfile(item.payload as { name?: string; phone?: string; region?: string })
              break
              
            case 'caregiver-create':
              await createCaregiver(item.payload as { name: string; email: string; phone: string; region: string; pin: string; role?: string })
              break
              
            default:
              console.warn(`[Sync] Unknown item type: ${item.type}`)
              continue
          }
          
          // Remove from queue on success
          await removeFromQueue(item.id!)
          successCount++
          console.log(`[Sync] Success ${item.type}`, item.id)
          
        } catch (err) {
          failCount++
          console.error(`[Sync] Failed ${item.type}`, item.id, err)
          await retryItem(item.id!)
        }
      }
      
      lastSyncTime = Date.now()
      
      if (successCount > 0 || failCount > 0) {
        console.log(`[Sync] Complete - Success: ${successCount}, Failed: ${failCount}`)
      }
      
    } catch (err) {
      syncError = err instanceof Error ? err.message : 'Unknown sync error'
      console.error('[Sync] Fatal error:', err)
    } finally {
      syncInProgress = false
    }
  }, [])

  useEffect(() => {
    // Initial sync
    sync()
    
    // Sync when coming back online
    const handleOnline = () => {
      console.log('[Sync] Device online - starting sync')
      sync()
    }
    
    window.addEventListener('online', handleOnline)
    
    // Periodic sync every 30 seconds
    const interval = setInterval(sync, 30000)
    
    // Sync on visibility change (when user returns to app)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        sync()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(interval)
    }
  }, [sync])
}
