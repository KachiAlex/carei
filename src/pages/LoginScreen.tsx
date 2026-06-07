import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { loginUser, updateBiometrics, biometricLogin } from '../api/client'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function LoginScreen() {
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)
  const [showBioSetup, setShowBioSetup] = useState(false)

  useEffect(() => {
    if (window.PublicKeyCredential) {
      setBioAvailable(true)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('carei_bio_email')
    if (stored && stored === email.trim().toLowerCase()) {
      setBioEnabled(true)
    } else {
      setBioEnabled(false)
    }
  }, [email])

  const handleSubmit = async () => {
    setError('')

    if (!validateEmail(email)) {
      setError('Enter a valid email address')
      return
    }
    if (pin.length !== 4) {
      setError('Enter your 4-digit PIN')
      return
    }

    setLoading(true)
    try {
      const res = await loginUser({ email: email.trim().toLowerCase(), pin }) as any
      setLoading(false)
      const role = res?.user?.role
      if (role === 'manager') {
        setLocation('/manager')
        return
      }
      const stored = localStorage.getItem('carei_bio_email')
      if (bioAvailable && stored !== email.trim().toLowerCase()) {
        setShowBioSetup(true)
      } else {
        setLocation('/dashboard')
      }
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Invalid email or PIN')
    }
  }

  const handleEnableBiometrics = async () => {
    try {
      const challenge = new Uint8Array(32)
      window.crypto.getRandomValues(challenge)

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: 'CAREi', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(email.trim().toLowerCase()),
          name: email.trim().toLowerCase(),
          displayName: email.trim().toLowerCase(),
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        attestation: 'none',
      }

      const credential = await navigator.credentials.create({ publicKey: publicKeyCredentialCreationOptions })
      if (credential) {
        await updateBiometrics({ credential: { id: credential.id, rawId: Array.from(new Uint8Array((credential as any).rawId)), type: credential.type }, enabled: true })
        localStorage.setItem('carei_bio_email', email.trim().toLowerCase())
        setShowBioSetup(false)
        setLocation('/dashboard')
      }
    } catch {
      setShowBioSetup(false)
      setLocation('/dashboard')
    }
  }

  const handleBiometricLogin = async () => {
    setError('')
    if (!validateEmail(email)) {
      setError('Enter your email first')
      return
    }
    setLoading(true)
    try {
      const challenge = new Uint8Array(32)
      window.crypto.getRandomValues(challenge)

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname,
        userVerification: 'required',
      }

      const assertion = await navigator.credentials.get({ publicKey: publicKeyCredentialRequestOptions })
      if (assertion) {
        const res = await biometricLogin({ email: email.trim().toLowerCase(), credentialId: assertion.id }) as any
        setLoading(false)
        if (res?.user?.role === 'manager') {
          setLocation('/manager')
        } else {
          setLocation('/dashboard')
        }
      }
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Biometric authentication failed')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
    >
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <button
          onClick={() => setLocation('/')}
          className="self-start mb-8 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer py-1 px-1 -ml-1 rounded-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>

        <h1 className="font-serif text-white text-3xl mb-2">Welcome back</h1>
        <p className="text-white/50 mb-6">Sign in with your email and PIN.</p>

        <div className="mb-4">
          <label className="block text-white/70 text-sm mb-2">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="carer@agency.co.uk"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div className="mb-6">
          <label className="block text-white/70 text-sm mb-2">4-digit PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setPin(v) }}
            placeholder="••••"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors text-center text-2xl tracking-[0.5em]"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3.5 rounded-full font-bold text-base cursor-pointer border-none disabled:opacity-50"
          style={{
            background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`,
            color: COLORS.darkNavy,
          }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        {bioAvailable && bioEnabled && (
          <button
            onClick={handleBiometricLogin}
            disabled={loading}
            className="w-full mt-3 py-3 rounded-full font-bold text-sm cursor-pointer border flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'white', background: 'transparent' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Sign in with Biometrics
          </button>
        )}

        <button
          onClick={() => setLocation('/manager/login')}
          className="w-full mt-4 text-sm text-white/40 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
        >
          Manager Login →
        </button>
      </div>

      {/* Biometric Setup Modal */}
      {showBioSetup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(79,209,197,0.1)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Z"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 mb-2">Enable Biometric Login?</h3>
            <p className="text-sm text-slate-500 mb-6">Sign in faster with fingerprint or Face ID next time.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowBioSetup(false); setLocation('/dashboard') }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#64748b' }}
              >
                Skip
              </button>
              <button
                onClick={handleEnableBiometrics}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white border-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
