import { useState, useRef, useEffect } from 'react'
import { useLocation, useSearch } from 'wouter'
import { loginUser, loginWithPassword, sendOtp, verifyOtp, resetPin, getMe, getUserType } from '../api/client'
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

// Enhanced PIN digit boxes with better mobile UX
function PinBoxes({ pin, onChange, onComplete, disabled }: { 
  pin: string[]; 
  onChange: (i: number, val: string) => void; 
  onComplete?: (value: string) => void;
  disabled?: boolean;
}) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleChange = (i: number, val: string) => {
    if (disabled) return
    const digit = val.replace(/\D/g, '').slice(0, 1)
    if (digit || val === '') {
      onChange(i, digit)
      if (digit) {
        triggerHaptic(HAPTIC_PATTERNS.tap)
      }
      if (digit && i < 3) {
        refs[i + 1].current?.focus()
      } else if (digit && i === 3 && onComplete) {
        const next = [...pin]
        next[i] = digit
        setTimeout(() => onComplete(next.join('')), 150)
      }
    }
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      onChange(i - 1, '')
      refs[i - 1].current?.focus()
    }
  }

  return (
    <div className="flex gap-4 justify-center">
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
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-16 h-18 rounded-2xl text-center text-2xl font-bold outline-none transition-all"
          style={{
            background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
            border: `2px solid ${digit ? COLORS.teal : 'rgba(255,255,255,0.2)'}`,
            color: COLORS.teal,
            caretColor: 'transparent',
            opacity: disabled ? 0.5 : 1,
          }}
        />
      ))}
    </div>
  )
}

type LoginView = 'email' | 'authenticate' | 'reset' | 'success'

interface UserInfo {
  isSuperAdmin: boolean
  hasBiometric: boolean
  emailVerified: boolean
  userId: string
}

export default function OptimizedLoginScreen() {
  const [, setLocation] = useLocation()
  const search = useSearch()
  const redirectPath = (() => {
    const params = new URLSearchParams(search)
    return params.get('redirect') || ''
  })()
  
  const [view, setView] = useState<LoginView>('email')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [newPin, setNewPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [resetStep, setResetStep] = useState<'email' | 'otp' | 'newpin'>('email')

  // Brute force protection
  const [failedAttempts, setFailedAttempts] = useState(() => {
    return parseInt(localStorage.getItem('carei_pin_fails') || '0', 10)
  })
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const raw = localStorage.getItem('carei_lockout')
    return raw ? parseInt(raw, 10) : null
  })
  const isLockedOut = lockoutUntil ? Date.now() < lockoutUntil : false

  // Check biometric availability
  useEffect(() => {
    if (getBiometricEnabled() && userInfo?.hasBiometric) {
      isBiometricAvailable().then(setBioAvailable)
    }
  }, [userInfo])

  const handleEmailSubmit = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      const userType = await getUserType(email)
      setUserInfo(userType)
      setView('authenticate')
      
      // Auto-trigger biometric if available
      if (userType.hasBiometric && getBiometricEnabled()) {
        const available = await isBiometricAvailable()
        if (available) {
          setTimeout(() => handleBiometricUnlock(), 500)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Email not found')
    } finally {
      setLoading(false)
    }
  }

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
        setError('Session expired. Please use PIN to login.')
        setLoading(false)
        return
      }
      const me = await getMe()
      if (me.user) {
        triggerHaptic(HAPTIC_PATTERNS.success)
        const userJson = JSON.stringify(me.user)
        await secureSet('user', userJson)
        setTokenCacheUser(userJson)
        setLocation(redirectPath || '/select-tenant')
      } else {
        throw new Error('Invalid session')
      }
    } catch (err: any) {
      setLoading(false)
      triggerHaptic(HAPTIC_PATTERNS.error)
      setError(err.message || 'Biometric unlock failed. Please use PIN.')
    }
  }

  const handleLogin = async () => {
    if (isLockedOut) {
      const mins = Math.ceil((lockoutUntil! - Date.now()) / 60000)
      setError(`Too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`)
      return
    }

    if (userInfo?.isSuperAdmin) {
      await handlePasswordLogin()
    } else {
      await handlePinLogin()
    }
  }

  const handlePinLogin = async (completedPin?: string) => {
    const pinValue = completedPin || pin.join('')
    if (pinValue.length !== 4) {
      setError('Please enter all 4 digits')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await loginUser({ email, pin: pinValue })
      triggerHaptic(HAPTIC_PATTERNS.success)
      await secureSet('token', response.token)
      await secureSet('user', JSON.stringify(response.user))
      setToken(response.token)
      setTokenCacheUser(JSON.stringify(response.user))
      
      // Reset failed attempts
      localStorage.removeItem('carei_pin_fails')
      localStorage.removeItem('carei_lockout')
      
      setLocation(redirectPath || '/select-tenant')
    } catch (err: any) {
      triggerHaptic(HAPTIC_PATTERNS.error)
      const newAttempts = failedAttempts + 1
      setFailedAttempts(newAttempts)
      localStorage.setItem('carei_pin_fails', newAttempts.toString())
      
      if (newAttempts >= 5) {
        const lockTime = Date.now() + 15 * 60 * 1000 // 15 minutes
        setLockoutUntil(lockTime)
        localStorage.setItem('carei_lockout', lockTime.toString())
        setError('Too many failed attempts. Locked for 15 minutes.')
      } else {
        setError(err.message || 'Invalid PIN')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async () => {
    if (!password) {
      setError('Please enter your password')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await loginWithPassword({ email, password })
      triggerHaptic(HAPTIC_PATTERNS.success)
      await secureSet('token', response.token)
      await secureSet('user', JSON.stringify(response.user))
      setToken(response.token)
      setTokenCacheUser(JSON.stringify(response.user))
      setLocation(redirectPath || '/super-admin')
    } catch (err: any) {
      triggerHaptic(HAPTIC_PATTERNS.error)
      setError(err.message || 'Invalid password')
    } finally {
      setLoading(false)
    }
  }

  const handleResetRequest = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      await sendOtp({ email, purpose: 'reset' })
      setResetStep('otp')
    } catch (err: any) {
      setError(err.message || 'Failed to send reset code')
    } finally {
      setLoading(false)
    }
  }

  const handleResetVerify = async () => {
    const otpValue = otp.join('')
    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits')
      return
    }

    setLoading(true)
    setError('')

    try {
      await verifyOtp({ email, code: otpValue, purpose: 'reset' })
      setResetStep('newpin')
    } catch (err: any) {
      setError(err.message || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPin = async () => {
    const pinValue = newPin.join('')
    if (pinValue.length !== 4) {
      setError('Please enter all 4 digits')
      return
    }

    setLoading(true)
    setError('')

    try {
      await resetPin({ email, newPin: pinValue, otp: otp.join('') })
      setView('success')
    } catch (err: any) {
      setError(err.message || 'Failed to reset PIN')
    } finally {
      setLoading(false)
    }
  }

  // Email View
  if (view === 'email') {
    return (
      <div className="min-h-screen flex flex-col font-sans" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full py-8 justify-center">
          {/* Logo */}
          <div className="text-center mb-8">
            <button 
              onClick={() => setLocation('/')}
              className="mb-6 bg-transparent border-none cursor-pointer transition-transform hover:scale-105"
              title="Go to home"
            >
              <img src="/logo.jpg" alt="CAREi" width="80" height="80" className="rounded-2xl mx-auto" style={{ objectFit: 'cover' }} />
            </button>
            <h1 className="font-serif text-white text-2xl mb-2">Welcome to CAREi</h1>
            <p className="text-white/50 text-sm">Enter your email to continue</p>
          </div>

          {/* Email Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-2 font-medium">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                onKeyPress={(e) => e.key === 'Enter' && handleEmailSubmit()}
                placeholder="Enter your email address"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-white/30 outline-none focus:border-teal transition-colors text-base"
                autoFocus
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              onClick={handleEmailSubmit}
              disabled={loading || !email}
              className="w-full py-4 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50 transition-all"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>

            <button
              onClick={() => setView('reset')}
              className="w-full py-3 text-sm text-white/50 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
            >
              Forgot PIN? Reset here
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Authentication View
  if (view === 'authenticate' && userInfo) {
    return (
      <div className="min-h-screen flex flex-col font-sans" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full py-8 justify-center">
          {/* Header */}
          <div className="text-center mb-8">
            <button 
              onClick={() => { setView('email'); setPin(['', '', '', '']); setPassword(''); }}
              className="mb-4 text-white/50 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <h1 className="font-serif text-white text-xl mb-2">
              Welcome back{userInfo.isSuperAdmin ? ', Admin' : ''}
            </h1>
            <p className="text-white/50 text-sm">{email}</p>
          </div>

          {/* Biometric Option */}
          {userInfo.hasBiometric && bioAvailable && !userInfo.isSuperAdmin && (
            <button
              onClick={handleBiometricUnlock}
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50 mb-4 flex items-center justify-center gap-3"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
              {loading ? 'Verifying...' : 'Unlock with Biometric'}
            </button>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin() }} className="space-y-4">
            {userInfo.isSuperAdmin ? (
              <div>
                <label className="block text-white/70 text-sm mb-2 font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="Enter your password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-white/30 outline-none focus:border-teal transition-colors text-base"
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <label className="block text-white/70 text-sm mb-3 font-medium">4-digit PIN</label>
                <PinBoxes
                  pin={pin}
                  onChange={(i, val) => { const next = [...pin]; next[i] = val; setPin(next); setError('') }}
                  onComplete={handlePinLogin}
                  disabled={loading}
                />
              </div>
            )}

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            {/* Remember Me */}
            {!userInfo.isSuperAdmin && (
              <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Remember me for 30 days
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Reset View (Consolidated)
  if (view === 'reset') {
    return (
      <div className="min-h-screen flex flex-col font-sans" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full py-8 justify-center">
          {/* Header */}
          <div className="text-center mb-8">
            <button 
              onClick={() => { setView('email'); setResetStep('email'); setOtp(['', '', '', '', '', '']); }}
              className="mb-4 text-white/50 hover:text-white transition-colors"
            >
              ← Back to login
            </button>
            <h1 className="font-serif text-white text-xl mb-2">Reset PIN</h1>
            <p className="text-white/50 text-sm">
              {resetStep === 'email' && 'Enter your email to receive a reset code'}
              {resetStep === 'otp' && 'Enter the 6-digit code sent to your email'}
              {resetStep === 'newpin' && 'Create your new 4-digit PIN'}
            </p>
          </div>

          {/* Step 1: Email */}
          {resetStep === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-2 font-medium">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  placeholder="Enter your email address"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-white/30 outline-none focus:border-teal transition-colors text-base"
                  autoFocus
                />
              </div>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              <button
                onClick={handleResetRequest}
                disabled={loading || !email}
                className="w-full py-4 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </div>
          )}

          {/* Step 2: OTP */}
          {resetStep === 'otp' && (
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-3 font-medium">6-digit code</label>
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

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              <button
                onClick={handleResetVerify}
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-4 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <button
                onClick={() => setResetStep('email')}
                className="w-full py-3 text-sm text-white/50 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
              >
                ← Change email
              </button>
            </div>
          )}

          {/* Step 3: New PIN */}
          {resetStep === 'newpin' && (
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-3 font-medium">New 4-digit PIN</label>
                <PinBoxes
                  pin={newPin}
                  onChange={(i, val) => { const next = [...newPin]; next[i] = val; setNewPin(next); setError('') }}
                  disabled={loading}
                />
              </div>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              <button
                onClick={handleResetPin}
                disabled={loading || newPin.join('').length !== 4}
                className="w-full py-4 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50"
                style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
              >
                {loading ? 'Setting...' : 'Set New PIN'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Success View
  if (view === 'success') {
    return (
      <div className="min-h-screen flex flex-col font-sans items-center justify-center" style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="font-serif text-white text-2xl mb-2">PIN Reset Successful!</h1>
          <p className="text-white/50 text-sm mb-8">You can now login with your new PIN</p>
          <button
            onClick={() => { setView('email'); setPin(['', '', '', '']); setNewPin(['', '', '', '']); }}
            className="px-8 py-3 rounded-xl font-bold text-base cursor-pointer border-none"
            style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return null
}
