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

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export default function LoginScreen() {
  const [, setLocation] = useLocation()
  const [method, setMethod] = useState<'sms' | 'email'>('sms')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')

    let target = ''
    if (method === 'sms') {
      if (!validateUKMobile(phone)) {
        setError('Enter a valid UK mobile number')
        return
      }
      target = phone
    } else {
      if (!validateEmail(email)) {
        setError('Enter a valid email address')
        return
      }
      target = email
    }

    setLoading(true)
    const otp = generateOTP()
    // Simulate OTP API call — store for development display
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)

    sessionStorage.setItem('carei_otp', otp)
    sessionStorage.setItem('carei_otp_method', method)
    sessionStorage.setItem('carei_otp_target', target)
    setLocation(`/otp`)
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
    >
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <button
          onClick={() => setLocation('/')}
          className="self-start mb-8 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer"
        >
          ← Back
        </button>

        <h1 className="font-serif text-white text-3xl mb-2">Welcome back</h1>
        <p className="text-white/50 mb-6">Sign in with your mobile or email.</p>

        {/* Method tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMethod('sms'); setError('') }}
            className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors"
            style={{
              background: method === 'sms' ? COLORS.teal : 'transparent',
              color: method === 'sms' ? COLORS.darkNavy : 'white',
            }}
          >
            SMS
          </button>
          <button
            onClick={() => { setMethod('email'); setError('') }}
            className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors"
            style={{
              background: method === 'email' ? COLORS.teal : 'transparent',
              color: method === 'email' ? COLORS.darkNavy : 'white',
            }}
          >
            Email
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-white/70 text-sm mb-2">
            {method === 'sms' ? 'Mobile number' : 'Email address'}
          </label>
          {method === 'sms' ? (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXX XXXXXX"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="carer@agency.co.uk"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          )}
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

        <button
          onClick={() => setLocation('/manager/login')}
          className="w-full mt-4 text-sm text-white/40 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
        >
          Manager Login →
        </button>
      </div>
    </div>
  )
}
