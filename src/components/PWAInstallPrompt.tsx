import { usePWAInstall } from '../hooks/usePWAInstall'
import { Download, X, Share2, PlusSquare } from 'lucide-react'

export function PWAInstallPrompt() {
  const { isInstallable, isIOS, isStandalone, prompt, dismiss } = usePWAInstall()

  if (isStandalone) return null

  // iOS manual install instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="mx-auto max-w-md rounded-2xl p-4 shadow-2xl" style={{ background: '#1B2A49', border: '1px solid rgba(79, 209, 197, 0.2)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white mb-1">Install CAREi on your iPhone</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tap <Share2 className="inline w-3 h-3 mx-0.5 text-teal-400" />, then tap
                <PlusSquare className="inline w-3 h-3 mx-0.5 text-teal-400" />
                <strong className="text-white">Add to Home Screen</strong>.
              </p>
            </div>
            <button onClick={dismiss} className="text-white/60 hover:text-white p-1" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Android/Chrome install prompt
  if (isInstallable) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="mx-auto max-w-md rounded-2xl p-4 shadow-2xl" style={{ background: '#1B2A49', border: '1px solid rgba(79, 209, 197, 0.2)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white mb-1">Install CAREi app</h3>
              <p className="text-xs text-slate-300 mb-3">Add to your home screen for quick access and offline support.</p>
              <button
                onClick={prompt}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(90deg, #4FD1C5, #3AAFA9)' }}
              >
                <Download className="w-4 h-4" />
                Install App
              </button>
            </div>
            <button onClick={dismiss} className="text-white/60 hover:text-white p-1" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
