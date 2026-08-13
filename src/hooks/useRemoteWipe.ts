import { useEffect, useRef, useState } from 'react'
import { secureGet, secureSet, secureWipe } from '../utils/secureStorage'
import { clearAuthCache } from '../utils/tokenCache'
import { checkDeviceWipe, acknowledgeWipe } from '../api/client'

const DEVICE_ID_KEY = 'carei_device_id'
const CHECK_INTERVAL_MS = 60000 // Check every 60 seconds

function generateDeviceId(): string {
  const ua = navigator.userAgent
  const screen = `${window.screen.width}x${window.screen.height}`
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const random = Math.random().toString(36).slice(2, 10)
  return 'dev_' + btoa(`${ua}|${screen}|${tz}|${random}`).replace(/=/g, '').slice(0, 32)
}

async function getOrCreateDeviceId(): Promise<string> {
  let id = await secureGet(DEVICE_ID_KEY)
  if (!id) {
    id = generateDeviceId()
    await secureSet(DEVICE_ID_KEY, id)
  }
  return id
}

export interface RemoteWipeState {
  wiping: boolean
  wipeReason: string | null
}

export function useRemoteWipe() {
  const [state, setState] = useState<RemoteWipeState>({ wiping: false, wipeReason: null })
  const deviceIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true
    let interval: ReturnType<typeof setInterval> | null = null

    async function init() {
      deviceIdRef.current = await getOrCreateDeviceId()
      if (!mounted) return

      // Check immediately on boot
      await checkWipe()

      // Then poll periodically
      interval = setInterval(checkWipe, CHECK_INTERVAL_MS)
    }

    async function checkWipe() {
      if (!deviceIdRef.current || !navigator.onLine) return

      try {
        const result: any = await checkDeviceWipe(deviceIdRef.current)
        if (!mounted || !result?.wipePending) return

        // Wipe command received — execute
        setState({ wiping: true, wipeReason: result.reason || 'Remote wipe command received' })
        console.warn('[RemoteWipe] Wipe command received:', result.reason)

        // Clear all secure storage
        await secureWipe()

        // Clear in-memory auth cache
        clearAuthCache()

        // Clear IndexedDB (offline queue, drafts, etc.)
        clearIndexedDB()

        // Clear all localStorage (non-secure keys too)
        clearLocalStorage()

        // Acknowledge wipe execution
        if (result.commandId) {
          try {
            await acknowledgeWipe(result.commandId)
          } catch (err) {
            console.error('[RemoteWipe] Failed to acknowledge wipe:', err)
          }
        }

        console.log('[RemoteWipe] Device wiped successfully')

        // Redirect to login after a brief delay
        setTimeout(() => {
          if (mounted) {
            window.location.href = '/login'
          }
        }, 1500)
      } catch (err) {
        // Silently fail — don't disrupt the app for wipe check failures
        console.error('[RemoteWipe] Check failed:', err)
      }
    }

    function clearIndexedDB() {
      const databases = ['carei-offline', 'carei-drafts']
      databases.forEach((dbName) => {
        try {
          indexedDB.deleteDatabase(dbName)
        } catch (err) {
          console.error(`[RemoteWipe] Failed to delete ${dbName}:`, err)
        }
      })
    }

    function clearLocalStorage() {
      try {
        localStorage.clear()
      } catch (err) {
        console.error('[RemoteWipe] Failed to clear localStorage:', err)
      }
    }

    init()

    // Also check when coming back online
    const handleOnline = () => {
      console.log('[RemoteWipe] Device online — checking for wipe commands')
      checkWipe()
    }
    window.addEventListener('online', handleOnline)

    return () => {
      mounted = false
      if (interval) clearInterval(interval)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return state
}
