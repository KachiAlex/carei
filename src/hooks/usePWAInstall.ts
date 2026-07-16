import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAInstallState {
  isInstallable: boolean
  isIOS: boolean
  isStandalone: boolean
  prompt: () => void
  dismiss: () => void
}

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true)
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream)

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler as EventListener)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener)
    }
  }, [])

  const prompt = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    }
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    setDeferredPrompt(null)
    setDismissed(true)
    try {
      localStorage.setItem('carei_pwa_install_dismissed', 'true')
    } catch {}
  }, [])

  useEffect(() => {
    try {
      if (localStorage.getItem('carei_pwa_install_dismissed') === 'true') {
        setDismissed(true)
      }
    } catch {}
  }, [])

  return {
    isInstallable: !!deferredPrompt && !dismissed,
    isIOS,
    isStandalone,
    prompt,
    dismiss,
  }
}
