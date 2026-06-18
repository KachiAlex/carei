import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getBiometricsStatus, updateBiometrics } from '../api/client'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  g2: '#94A3B8',
}

function supportsWebAuthn(): boolean {
  return typeof window !== 'undefined' &&
    'PublicKeyCredential' in window &&
    typeof (window as any).PublicKeyCredential === 'function'
}

export default function BiometricsPrompt() {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('carei_token')
    if (!token) return
    if (!supportsWebAuthn()) return
    // Don't show if user dismissed in this session
    if (sessionStorage.getItem('carei_bio_prompt_dismissed')) return

    let cancelled = false
    getBiometricsStatus()
      .then((data) => {
        if (cancelled) return
        if (!data.enabled) {
          setShow(true)
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [])

  const handleEnable = async () => {
    setError('')
    setLoading(true)
    try {
      await updateBiometrics({ enabled: true })
      setShow(false)
      sessionStorage.setItem('carei_bio_prompt_dismissed', '1')
    } catch (err: any) {
      setError(err.message || 'Failed to enable biometrics')
    } finally {
      setLoading(false)
    }
  }

  const handleLater = () => {
    setShow(false)
    sessionStorage.setItem('carei_bio_prompt_dismissed', '1')
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-5"
          onClick={handleLater}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}20, ${COLORS.teal2}10)` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>

              <h3 className="font-bold text-slate-800 text-lg mb-1">Enable Biometric Login</h3>
              <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                Log in faster and more securely using your device's fingerprint or face recognition.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-600 mb-4 w-full">
                  {error}
                </div>
              )}

              <div className="flex gap-3 w-full">
                <button
                  onClick={handleLater}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer disabled:opacity-50"
                  style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b', background: 'transparent' }}
                >
                  Maybe Later
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleEnable}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
                >
                  {loading ? 'Enabling...' : 'Enable Now'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
