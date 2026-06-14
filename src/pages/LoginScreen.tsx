import { useState, useRef } from 'react'
import { useLocation } from 'wouter'
import { loginUser } from '../api/client'

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
function PinBoxes({ pin, onChange, onComplete }: { pin: string[]; onChange: (i: number, val: string) => void; onComplete?: () => void }) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(0, 1)
    if (digit || val === '') {
      onChange(i, digit)
      if (digit && i < 3) {
        refs[i + 1].current?.focus()
      } else if (digit && i === 3 && onComplete) {
        // Small delay to show the digit before submitting
        setTimeout(onComplete, 150)
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
          maxLength={1}
          value={digit ? '●' : ''}
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

export default function LoginScreen() {
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePinChange = (idx: number, val: string) => {
    const next = [...pin]
    next[idx] = val
    setPin(next)
    setError('')
  }

  const handleVerify = async () => {
    const pinValue = pin.join('')
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
    
    // Real authentication via API
    try {
      const res = await loginUser({ email: email.trim().toLowerCase(), pin: pinValue })
      setLoading(false)
      if (res.user) {
        localStorage.setItem('carei_user', JSON.stringify(res.user))
        setLocation(res.user.role === 'manager' ? '/manager' : '/dashboard')
      } else {
        setError('Invalid email or PIN.')
        setPin(['', '', '', ''])
      }
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Login failed. Please try again.')
      setPin(['', '', '', ''])
    }
  }


  const getInitials = (name: string) => {
    return name.trim().split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

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
        </div>


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
          
          <div>
            <label className="block text-white/70 text-sm mb-4 font-medium">4-digit PIN</label>
            <PinBoxes 
              pin={pin} 
              onChange={handlePinChange} 
              onComplete={handleVerify}
            />
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

        {/* Login Button */}
        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50"
          style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
        >
          {loading ? 'Signing in…' : 'Log In'}
        </button>

        {/* Forgot PIN */}
        <button
          onClick={() => alert('Please email support@carei.co.uk to reset your PIN.')}
          className="w-full mt-4 text-xs text-white/30 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
        >
          Forgot PIN? Email support@carei.co.uk
        </button>

        {/* Sign Up Link */}
        <button
          onClick={() => setLocation('/register')}
          className="w-full mt-6 text-sm text-white/50 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
        >
          New here? Sign up instead
        </button>
      </div>
    </div>
  )
}
