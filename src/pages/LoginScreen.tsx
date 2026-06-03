import { useState } from 'react'
import { useLocation } from 'wouter'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
}

function validateUKMobile(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '').replace(/^\+44/, '0')
  return /^07\d{9}$/.test(cleaned)
}

export default function LoginScreen() {
  const [, setLocation] = useLocation()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!validateUKMobile(phone)) {
      setError('Enter a valid UK mobile number')
      return
    }
    setLoading(true)
    // Simulate OTP API call
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    setLocation(`/otp?phone=${encodeURIComponent(phone)}`)
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
    >
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <button
          onClick={() => setLocation('/')}
          className="self-start mb-8 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          ← Back
        </button>

        <h1 className="font-serif text-white text-3xl mb-2">Welcome back</h1>
        <p className="text-white/50 mb-8">Enter your mobile number to sign in.</p>

        <div className="mb-6">
          <label className="block text-white/70 text-sm mb-2">Mobile number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XXX XXXXXX"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
            style={{ '--tw-border-opacity': 0.1 } as React.CSSProperties}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3.5 rounded-full font-bold text-base cursor-pointer border-none disabled:opacity-50"
          style={{
            background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`,
            color: COLORS.darkNavy,
          }}
        >
          {loading ? 'Sending code…' : 'Send OTP'}
        </button>
      </div>
    </div>
  )
}
