import { useState, useRef, useEffect } from 'react'
import { useLocation, useSearch } from 'wouter'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
}

export default function OTPScreen() {
  const [, setLocation] = useLocation()
  const [search] = useSearch()
  const params = new URLSearchParams(search)
  const phone = params.get('phone') || ''
  const email = params.get('email') || ''
  const expectedOtp = params.get('otp') || ''
  const target = phone || email

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...code]
    next[idx] = val
    setCode(next)
    setError('')
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const full = code.join('')
    if (full.length !== 6) {
      setError('Enter all 6 digits')
      return
    }
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    // In development, accept the generated OTP. In production, verify server-side.
    if (expectedOtp && full !== expectedOtp) {
      setError('Invalid code. Try again.')
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
      return
    }
    setLocation('/dashboard')
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
    >
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <button
          onClick={() => setLocation('/login')}
          className="self-start mb-8 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer"
        >
          ← Back
        </button>

        <h1 className="font-serif text-white text-3xl mb-2">Verify your {phone ? 'number' : 'email'}</h1>
        <p className="text-white/50 mb-4">
          Enter the 6-digit code sent to <span className="text-white/80">{target}</span>
        </p>

        {/* Development OTP display */}
        {expectedOtp && (
          <div className="bg-teal/10 border border-teal/30 rounded-xl p-4 mb-6 text-center">
            <div className="text-xs text-teal mb-1">Development — Your OTP code</div>
            <div className="text-2xl font-mono font-bold tracking-widest" style={{ color: COLORS.teal }}>{expectedOtp}</div>
            <div className="text-[10px] text-white/40 mt-1">This appears because domain verification is pending</div>
          </div>
        )}

        <div className="flex gap-2 mb-6 justify-center">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-white text-2xl outline-none focus:border-teal transition-colors"
            />
          ))}
        </div>

        {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}

        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full py-3.5 rounded-full font-bold text-base cursor-pointer border-none disabled:opacity-50 mb-4"
          style={{
            background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`,
            color: COLORS.darkNavy,
          }}
        >
          {loading ? 'Verifying…' : 'Verify'}
        </button>

        <button
          onClick={() => {
            setCode(['', '', '', '', '', ''])
            setError('')
            inputRefs.current[0]?.focus()
          }}
          className="text-teal text-sm text-center w-full bg-transparent border-none cursor-pointer"
        >
          Resend code
        </button>
      </div>
    </div>
  )
}
