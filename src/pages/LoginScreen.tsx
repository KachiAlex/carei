import { useState, useRef, useEffect } from 'react'
import { useLocation, useSearch } from 'wouter'
import { loginUser, loginWithPassword, sendOtp, verifyOtp, resetPin, getMe } from '../api/client'
import { isBiometricAvailable, verifyBiometric, getBiometricEnabled } from '../utils/biometric'
import { triggerHaptic, HAPTIC_PATTERNS } from '../utils/haptic'
import { secureSet } from '../utils/secureStorage'
import { getToken, setToken, setUser as setTokenCacheUser } from '../utils/tokenCache'

const COLORS = {
  darkNavy: '#0F1D34',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  red: '#FF5A5F',
  green: '#22C55E',
  g2: '#94A3B8',
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// PIN digit boxes component with auto-submit
function PinBoxes({ pin, onChange, onComplete }: { pin: string[]; onChange: (i: number, val: string) => void; onComplete?: (value: string) => void }) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(0, 1)
    if (digit || val === '') {
      onChange(i, digit)
      if (digit) {
        triggerHaptic(HAPTIC_PATTERNS.tap)
      }
      if (digit && i < 3) {
        refs[i + 1].current?.focus()
      } else if (digit && i === 3 && onComplete) {
        // Pass the completed pin value directly to avoid state batching issues
        const next = [...pin]
        next[i] = digit
        setTimeout(() => onComplete(next.join('')), 150)
      }
    }
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      onChange(i - 1, '')
      refs[i - 1].current?.focus()
    }
  }

  return (
    <div className="flex gap-3 justify-center">
      {pin.map((digit, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          autoComplete="off"
          aria-label={`PIN digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-14 h-16 rounded-xl text-center text-2xl font-bold outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: `2px solid ${digit ? COLORS.teal : 'rgba(255,255,255,0.2)'}`,
            color: COLORS.teal,
            caretColor: 'transparent',
          }}
        />
      ))}
    </div>
  )
}

type LoginView = 'login' | 'reset-request' | 'reset-verify' | 'reset-newpin'

export default function LoginScreen() {
  const [, setLocation] = useLocation()
  const search = useSearch()
  const redirectPath = (() => {
    const params = new URLSearchParams(search)
    return params.get('redirect') || ''
  })()
  const [view, setView] = useState<LoginView>('login')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [newPin, setNewPin] = useState(['', '', '', ''])
  const [confirmNewPin, setConfirmNewPin] = useState(['', '', '', ''])
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false)
  const [password, setPassword] = useState('')
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)

  // Brute force protection
  const [failedAttempts, setFailedAttempts] = useState(() => {
    return parseInt(localStorage.getItem('carei_pin_fails') || '0', 10)
  })
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const raw = localStorage.getItem('carei_lockout')
    return raw ? parseInt(raw, 10) : null
  })

  const isLockedOut = lockoutUntil ? Date.now() < lockoutUntil : false

  // Check biometric availability on mount
  useEffect(() => {
    if (getBiometricEnabled()) {
      setBioEnabled(true)
      isBiometricAvailable().then(setBioAvailable)
    }
  }, [])

  const handleBiometricUnlock = async () => {
    setError('')
    setLoading(true)
    try {
      const success = await verifyBiometric()
      if (!success) {
        triggerHaptic(HAPTIC_PATTERNS.error)
        setLoading(false)
        return
      }
      triggerHaptic(HAPTIC_PATTERNS.success)
      const token = getToken()
      if (!token) {
        setError('Session expired. Please log in with PIN.')
        setBioEnabled(false)
        setLoading(false)
        return
      }
      const me = await getMe()
      if (me.user) {
        triggerHaptic(HAPTIC_PATTERNS.success)
        const userJson = JSON.stringify(me.user)
        await secureSet('user', userJson)
        setTokenCacheUser(userJson)
        setLocation('/select-tenant')
      } else {
        throw new Error('Invalid session')
      }
    } catch (err: any) {
      setLoading(false)
      triggerHaptic(HAPTIC_PATTERNS.error)
      setError(err.message || 'Biometric unlock failed. Please use PIN.')
      setBioEnabled(false)
    }
  }

  // Hidden keyboard shortcut to toggle superadmin mode: Ctrl+Shift+A
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setIsSuperAdminMode(prev => {
          const next = !prev
          setError('')
          setPassword('')
          setPin(['', '', '', ''])
          return next
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handlePinChange = (idx: number, val: string) => {
    const next = [...pin]
    next[idx] = val
    setPin(next)
    setError('')
  }

  const handleVerify = async (completedPin?: string) => {
    if (isLockedOut) {
      const mins = Math.ceil((lockoutUntil! - Date.now()) / 60000)
      setError(`Too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`)
      return
    }
    const pinValue = completedPin || pin.join('')
    if (!validateEmail(email)) {
      setError('Please enter your email address.')
      return
    }
    if (pinValue.length !== 4) {
      setError('Please enter all 4 digits.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await loginUser({ email: email.trim().toLowerCase(), pin: pinValue })
      setLoading(false)
      if (res.user) {
        triggerHaptic(HAPTIC_PATTERNS.success)
        // Clear brute force counter on success
        setFailedAttempts(0)
        localStorage.removeItem('carei_pin_fails')
        localStorage.removeItem('carei_lockout')
        setLockoutUntil(null)
        // Store user securely + cache
        const userJson = JSON.stringify(res.user)
        await secureSet('user', userJson)
        setTokenCacheUser(userJson)
        // Bind biometric to this login session
        const sessionKey = crypto.randomUUID()
        await secureSet('bio_session', sessionKey)
        if (res.user.role === 'superadmin') {
          setLocation(redirectPath || '/super-admin')
        } else {
          setLocation(redirectPath || '/select-tenant')
        }
      } else {
        triggerHaptic(HAPTIC_PATTERNS.error)
        recordFailedAttempt()
        setError('Invalid email or PIN.')
        setPin(['', '', '', ''])
      }
    } catch (err: any) {
      setLoading(false)
      triggerHaptic(HAPTIC_PATTERNS.error)
      recordFailedAttempt()
      setError(err.message || 'Login failed. Please try again.')
      setPin(['', '', '', ''])
    }
  }

  const recordFailedAttempt = () => {
    const next = failedAttempts + 1
    setFailedAttempts(next)
    localStorage.setItem('carei_pin_fails', String(next))
    if (next >= 5) {
      const until = Date.now() + 15 * 60 * 1000
      setLockoutUntil(until)
      localStorage.setItem('carei_lockout', String(until))
      setError('Too many failed attempts. Locked for 15 minutes.')
    }
  }

  const handlePasswordLogin = async () => {
    if (!validateEmail(email)) {
      setError('Please enter your email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    if (isLockedOut) {
      const mins = Math.ceil((lockoutUntil! - Date.now()) / 60000)
      setError(`Too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`)
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await loginWithPassword({ email: email.trim().toLowerCase(), password })
      setLoading(false)
      if (res.user) {
        triggerHaptic(HAPTIC_PATTERNS.success)
        const userJson = JSON.stringify(res.user)
        await secureSet('user', userJson)
        setTokenCacheUser(userJson)
        const sessionKey = crypto.randomUUID()
        await secureSet('bio_session', sessionKey)
        if (res.user.role === 'superadmin') {
          setLocation(redirectPath || '/super-admin')
        } else {
          setLocation(redirectPath || '/select-tenant')
        }
      } else {
        triggerHaptic(HAPTIC_PATTERNS.error)
        recordFailedAttempt()
        setError('Invalid email or password.')
        setPassword('')
      }
    } catch (err: any) {
      setLoading(false)
      triggerHaptic(HAPTIC_PATTERNS.error)
      recordFailedAttempt()
      setError(err.message || 'Login failed. Please try again.')
      setPassword('')
    }
  }

  // Request OTP for PIN reset - uses backend only
  const handleRequestReset = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    
    setError('')
    setLoading(true)
    
    try {
      // Call backend API to generate and store OTP in database
      const res = await sendOtp({ email: email.trim().toLowerCase(), purpose: 'reset-pin' }) as any
      
      if (!res?.status || res.status !== 'sent') {
        setError('Failed to generate reset code. Please try again.')
        setLoading(false)
        return
      }
      
      setLoading(false)
      setView('reset-verify')
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Failed to send reset code. Please check your connection.')
    }
  }

  // Verify OTP against backend only
  const handleVerifyOtp = async () => {
    const enteredOtp = otp.join('')
    if (enteredOtp.length !== 6) {
      setError('Please enter all 6 digits.')
      return
    }
    
    setLoading(true)
    
    try {
      // Verify OTP against database via backend API
      const res = await verifyOtp({ 
        email: email.trim().toLowerCase(), 
        code: enteredOtp, 
        purpose: 'reset-pin' 
      }) as any
      
      if (res?.success || res?.valid) {
        setError('')
        setView('reset-newpin')
      } else {
        setError('Invalid code. Please try again.')
        setOtp(['', '', '', '', '', ''])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify code. Please try again.')
      setOtp(['', '', '', '', '', ''])
    } finally {
      setLoading(false)
    }
  }

  // Set new PIN - try database first, fallback to local update
  const handleSetNewPin = async () => {
    const newPinValue = newPin.join('')
    const confirmValue = confirmNewPin.join('')
    
    if (newPinValue.length !== 4) {
      setError('Please enter all 4 digits for new PIN.')
      return
    }
    if (newPinValue !== confirmValue) {
      setError('PINs do not match.')
      return
    }
    
    setError('')
    setLoading(true)
    
    // Call backend API to update PIN in database
    try {
      const enteredOtp = otp.join('')
      const res = await resetPin({ 
        email: email.trim().toLowerCase(), 
        newPin: newPinValue, 
        otp: enteredOtp 
      }) as any
      
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to reset PIN')
      }
      
      // Store user data securely from response
      if (res?.token) {
        setToken(res.token)
        await secureSet('token', res.token)
      }
      if (res?.user) {
        const userJson = JSON.stringify(res.user)
        await secureSet('user', userJson)
        setTokenCacheUser(userJson)
      }
      
      setLoading(false)
      setResetSuccess(true)
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Failed to reset PIN. Please try again.')
      return
    }
    
    setTimeout(() => {
      setView('login')
      setResetSuccess(false)
      setPin(['', '', '', ''])
      setNewPin(['', '', '', ''])
      setConfirmNewPin(['', '', '', ''])
      setOtp(['', '', '', '', '', ''])
    }, 2000)
  }

  // Render Login View
  if (view === 'login') {
    return (
      <div
        className="min-h-screen flex flex-col font-sans overflow-y-auto"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-serif text-white text-2xl mb-2">CARE<span style={{ color: COLORS.teal }}>i</span></h1>
            <h2 className="font-serif text-white text-xl">Welcome back</h2>
            <p className="text-white/50 text-sm mt-2">{isSuperAdminMode ? 'Super Admin Login' : 'Carer Login'}</p>
          </div>

          <form
            id="login-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (isSuperAdminMode) {
                handlePasswordLogin()
              } else {
                handleVerify()
              }
            }}
          >
            {/* Email Input */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-white/70 text-sm mb-2 font-medium">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
                />
              </div>

              {isSuperAdminMode ? (
                <div>
                  <label className="block text-white/70 text-sm mb-2 font-medium">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                    placeholder="Enter your password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-white/70 text-sm mb-4 font-medium">4-digit PIN</label>
                  <form onSubmit={(e) => { e.preventDefault(); handleVerify() }}>
                    <PinBoxes
                      pin={pin}
                      onChange={handlePinChange}
                      onComplete={handleVerify}
                    />
                  </form>
                </div>
              )}
            </div>

            {/* Error */}
            {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

            {/* Biometric Unlock */}
            {!isSuperAdminMode && bioEnabled && bioAvailable && (
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50 mb-3 flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
                {loading ? 'Verifying…' : 'Unlock with Biometric'}
              </button>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              {loading ? 'Signing in…' : 'Log In'}
            </button>
          </form>

          {/* Forgot PIN (only for carer mode) */}
          {!isSuperAdminMode && (
            <button
              onClick={() => {
                setView('reset-request')
                setError('')
                setPin(['', '', '', ''])
              }}
              className="w-full mt-4 text-sm text-white/50 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
            >
              Forgot PIN? Reset here
            </button>
          )}

          {/* Super Admin toggle */}
          <button
            onClick={() => {
              setIsSuperAdminMode(prev => {
                const next = !prev
                setError('')
                setPassword('')
                return next
              })
            }}
            className="w-full mt-3 text-sm text-white/40 bg-transparent border-none cursor-pointer hover:text-teal-400 transition-colors"
          >
            {isSuperAdminMode ? '← Back to Carer Login' : 'Super Admin Login →'}
          </button>
        </div>
      </div>
    )
  }

  // Render Reset Request View
  if (view === 'reset-request') {
    return (
      <div
        className="min-h-screen flex flex-col font-sans overflow-y-auto"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-serif text-white text-2xl mb-2">CARE<span style={{ color: COLORS.teal }}>i</span></h1>
            <h2 className="font-serif text-white text-xl">Reset PIN</h2>
            <p className="text-white/50 text-sm mt-2">Enter your email to receive a reset code</p>
          </div>

          {/* Email Input */}
          <div className="mb-6">
            <label className="block text-white/70 text-sm mb-2 font-medium">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
            />
          </div>

          {/* Error */}
          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

          {/* Send Code Button */}
          <button
            onClick={handleRequestReset}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50 mb-4"
            style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
          >
            {loading ? 'Sending…' : 'Send Reset Code'}
          </button>

          {/* Back to Login */}
          <button
            onClick={() => setView('login')}
            className="w-full text-sm text-white/50 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
          >
            ← Back to login
          </button>
        </div>
      </div>
    )
  }

  // Render OTP Verification View
  if (view === 'reset-verify') {
    return (
      <div
        className="min-h-screen flex flex-col font-sans overflow-y-auto"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-serif text-white text-2xl mb-2">CARE<span style={{ color: COLORS.teal }}>i</span></h1>
            <h2 className="font-serif text-white text-xl">Enter Reset Code</h2>
            <p className="text-white/50 text-sm mt-2">Enter the 6-digit code sent to {email}</p>
          </div>

          {/* OTP Input */}
          <div className="mb-6">
            <label className="block text-white/70 text-sm mb-4 font-medium">6-digit code</label>
            <div className="flex gap-2 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 1)
                    const next = [...otp]
                    next[i] = val
                    setOtp(next)
                    if (val && i < 5) {
                      const nextInput = e.target.parentElement?.children[i + 1] as HTMLInputElement
                      nextInput?.focus()
                    }
                  }}
                  className="w-12 h-14 rounded-xl text-center text-xl font-bold outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: `2px solid ${digit ? COLORS.teal : 'rgba(255,255,255,0.2)'}`,
                    color: COLORS.teal,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

          {/* Verify Button */}
          <button
            onClick={handleVerifyOtp}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50 mb-4"
            style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
          >
            Verify Code
          </button>

          {/* Back */}
          <button
            onClick={() => setView('reset-request')}
            className="w-full text-sm text-white/50 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // Render New PIN View
  if (view === 'reset-newpin') {
    return (
      <div
        className="min-h-screen flex flex-col font-sans overflow-y-auto"
        style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
      >
        <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-serif text-white text-2xl mb-2">CARE<span style={{ color: COLORS.teal }}>i</span></h1>
            <h2 className="font-serif text-white text-xl">Set New PIN</h2>
            <p className="text-white/50 text-sm mt-2">Create a new 4-digit PIN</p>
          </div>

          {resetSuccess ? (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-white font-bold text-lg">PIN reset successful!</p>
              <p className="text-white/50 text-sm">Redirecting to login...</p>
            </div>
          ) : (
            <>
              {/* New PIN */}
              <div className="mb-4">
                <label className="block text-white/70 text-sm mb-4 font-medium">New 4-digit PIN</label>
                <PinBoxes
                  pin={newPin}
                  onChange={(i, val) => {
                    const next = [...newPin]
                    next[i] = val
                    setNewPin(next)
                    setError('')
                  }}
                />
              </div>

              {/* Confirm PIN */}
              <div className="mb-6">
                <label className="block text-white/70 text-sm mb-4 font-medium">Confirm new PIN</label>
                <PinBoxes
                  pin={confirmNewPin}
                  onChange={(i, val) => {
                    const next = [...confirmNewPin]
                    next[i] = val
                    setConfirmNewPin(next)
                    setError('')
                  }}
                />
              </div>

              {/* Error */}
              {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

              {/* Set PIN Button */}
              <button
                onClick={handleSetNewPin}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50 mb-4"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
              >
                {loading ? 'Saving…' : 'Set New PIN'}
              </button>

              {/* Back */}
              <button
                onClick={() => setView('reset-verify')}
                className="w-full text-sm text-white/50 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
              >
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}
