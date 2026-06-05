import { useState } from 'react'
import { useLocation } from 'wouter'
import { loginUser } from '../api/client'

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
      await loginUser({ email: email.trim().toLowerCase(), pin })
      setLoading(false)
      setLocation('/dashboard')
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Invalid email or PIN')
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

        <button
          onClick={() => setLocation('/register')}
          className="w-full mt-4 text-sm text-white/40 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
        >
          Create Account →
        </button>
        <button
          onClick={() => setLocation('/manager/login')}
          className="w-full mt-2 text-sm text-white/40 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
        >
          Manager Login →
        </button>
      </div>
    </div>
  )
}
