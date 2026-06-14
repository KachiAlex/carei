import { useState, useRef } from 'react'
import { useLocation } from 'wouter'
import { DEMO_CARER, DEMO_MANAGER } from '../data/demoData'
import type { UserRole } from '../types'

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
  const [demoLoading, setDemoLoading] = useState<UserRole | null>(null)

  const handlePinChange = (idx: number, val: string) => {
    const next = [...pin]
    next[idx] = val
    setPin(next)
    setError('')
  }

  const handleVerify = () => {
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
    
    // Demo authentication - check stored user or default to demo
    const storedUser = localStorage.getItem('carei_user')
    let user = storedUser ? JSON.parse(storedUser) : null
    
    // For demo, accept any PIN if email matches demo accounts
    if (email.toLowerCase().includes('sarah') || email.toLowerCase().includes('adjoy')) {
      user = DEMO_CARER
    } else if (email.toLowerCase().includes('alex') || email.toLowerCase().includes('manager')) {
      user = DEMO_MANAGER
    }
    
    if (user) {
      localStorage.setItem('carei_user', JSON.stringify(user))
      localStorage.setItem('carei_token', 'demo-token-' + Date.now())
      
      setTimeout(() => {
        setLoading(false)
        setLocation(user.role === 'manager' ? '/manager' : '/dashboard')
      }, 800)
    } else {
      setLoading(false)
      setError('Invalid email or PIN.')
      setPin(['', '', '', ''])
    }
  }

  const handleDemoLogin = (role: UserRole) => {
    setDemoLoading(role)
    const isManager = role === 'manager'
    const user = isManager ? DEMO_MANAGER : DEMO_CARER
    
    setTimeout(() => {
      localStorage.setItem('carei_user', JSON.stringify(user))
      localStorage.setItem('carei_token', 'demo-token-' + Date.now())
      setLocation(isManager ? '/manager' : '/dashboard')
    }, 800)
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

        {/* Demo Accounts */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="text-center">
            <span className="text-white/30 text-[10px] font-bold uppercase tracking-wider">Demo Accounts</span>
          </div>
          
          {[
            { role: 'carer' as UserRole, icon: '👩‍⚕️', label: 'Care Worker', sub: 'Adjoy Healthcare · Sarah O\'Brien' },
            { role: 'manager' as UserRole, icon: '🏢', label: 'Agency Manager', sub: 'Adjoy Healthcare · Manager Portal' },
          ].map((acc) => (
            <button
              key={acc.role}
              onClick={() => handleDemoLogin(acc.role)}
              disabled={demoLoading !== null}
              className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all text-left disabled:opacity-50"
              style={{
                border: `1.5px solid ${acc.role === 'carer' ? 'rgba(79,209,197,0.4)' : 'rgba(255,255,255,0.12)'}`,
                background: acc.role === 'carer' ? 'rgba(79,209,197,0.08)' : 'rgba(255,255,255,0.04)',
              }}
            >
              <span className="text-2xl flex-shrink-0">{acc.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm">{acc.label}</div>
                <div className="text-white/50 text-xs truncate">{acc.sub}</div>
              </div>
              {demoLoading === acc.role ? (
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.teal }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.teal, animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.teal, animationDelay: '0.4s' }} />
                </div>
              ) : (
                <span style={{ color: acc.role === 'manager' ? COLORS.teal : COLORS.g2 }}>›</span>
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs">or sign in with your account</span>
          <div className="flex-1 h-px bg-white/10" />
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
