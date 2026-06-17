import { useState } from 'react'
import { useLocation } from 'wouter'
import { loginUser } from '../api/client'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
}

export default function ManagerLoginScreen() {
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email')
      return
    }
    if (pin.length !== 4) {
      setError('Enter 4-digit PIN')
      return
    }
    setLoading(true)
    try {
      const res = await loginUser({ email: email.trim().toLowerCase(), pin }) as any
      setLoading(false)
      if (res?.user?.role === 'manager') {
        localStorage.setItem('carei_user', JSON.stringify(res.user))
        setLocation('/select-tenant')
      } else {
        setError('Not a manager account')
      }
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Invalid email or PIN')
    }
  }

  const appendDigit = (d: string) => {
    if (pin.length < 4) setPin((p) => p + d)
  }

  const backspace = () => setPin((p) => p.slice(0, -1))

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 font-sans">
      <div className="w-full max-w-sm">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 mx-auto"
          style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.darkNavy} strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl text-center mb-1 text-slate-800">Manager Access</h1>
        <p className="text-sm text-slate-400 text-center mb-6">Enter your email and 4-digit PIN</p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Manager email"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal bg-white mb-4"
        />

        {/* PIN Dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-colors"
              style={{ background: i < pin.length ? COLORS.teal : '#e2e8f0' }}
            />
          ))}
        </div>

        {error && <p className="text-xs text-red-500 text-center mb-4">{error}</p>}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) => (
            <button
              key={i}
              onClick={() => {
                if (key === '⌫') backspace()
                else if (key !== '') appendDigit(key)
              }}
              disabled={key === '' || loading}
              className="aspect-square rounded-xl text-lg font-semibold cursor-pointer border-none disabled:opacity-0 hover:bg-slate-100 transition-colors"
              style={{ background: 'white', color: '#334155', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              {key}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={pin.length !== 4 || loading}
          className="w-full py-3.5 rounded-full font-bold text-base cursor-pointer border-none disabled:opacity-40"
          style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
        >
          {loading ? 'Checking...' : 'Unlock'}
        </button>

        <button
          onClick={() => setLocation('/login')}
          className="w-full mt-4 text-sm text-slate-400 bg-transparent border-none cursor-pointer hover:text-slate-600"
        >
          Switch to Carer Login
        </button>
      </div>
    </div>
  )
}
