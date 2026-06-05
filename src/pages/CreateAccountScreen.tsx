import { useState } from 'react'
import { useLocation } from 'wouter'
import { registerUser } from '../api/client'

const COLORS = {
  darkNavy: '#0f1a2e',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#40E0D0',
  red: '#FF5A5F',
}

function validateUKMobile(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '').replace(/^\+44/, '0')
  return /^07\d{9}$/.test(cleaned)
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function CreateAccountScreen() {
  const [, setLocation] = useLocation()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState('Manchester')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const regions = ['Manchester', 'London', 'Birmingham', 'Leeds', 'Liverpool', 'Bristol', 'Sheffield']

  const handleStep1 = () => {
    setError('')
    if (!name.trim()) { setError('Enter your full name'); return }
    if (!validateEmail(email)) { setError('Enter a valid email address'); return }
    if (!validateUKMobile(phone)) { setError('Enter a valid UK mobile number'); return }
    setStep(2)
  }

  const handleCreate = async () => {
    setError('')
    if (pin.length !== 4) { setError('PIN must be 4 digits'); return }
    if (pin !== confirmPin) { setError('PINs do not match'); return }

    setLoading(true)
    try {
      const res = await registerUser({
        id: crypto.randomUUID ? crypto.randomUUID() : `u-${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\s/g, ''),
        region,
        pin,
        role: 'carer',
      })
      localStorage.setItem('carei_token', res.token)
      setLoading(false)
      setLocation('/dashboard')
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Failed to create account')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
    >
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <button
          onClick={() => step === 1 ? setLocation('/') : setStep(1)}
          className="self-start mb-8 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer py-1 px-1 -ml-1 rounded-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>

        <h1 className="font-serif text-white text-3xl mb-2">{step === 1 ? 'Create Account' : 'Set Your PIN'}</h1>
        <p className="text-white/50 mb-6">
          {step === 1 ? 'Join CAREi to manage your care shifts digitally.' : 'Choose a 4-digit PIN for quick login.'}
        </p>

        {step === 1 ? (
          <>
            <div className="mb-4">
              <label className="block text-white/70 text-sm mb-2">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
              />
            </div>

            <div className="mb-4">
              <label className="block text-white/70 text-sm mb-2">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carer@agency.co.uk"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
              />
            </div>

            <div className="mb-4">
              <label className="block text-white/70 text-sm mb-2">Mobile number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXX XXXXXX"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
              />
            </div>

            <div className="mb-6">
              <label className="block text-white/70 text-sm mb-2">Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white outline-none focus:border-teal transition-colors appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
              >
                {regions.map((r) => (
                  <option key={r} value={r} className="bg-slate-800 text-white">{r}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

            <button
              onClick={handleStep1}
              className="w-full py-3.5 rounded-full font-bold text-base cursor-pointer border-none"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-white/70 text-sm mb-2">4-digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setPin(v) }}
                placeholder="••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors text-center text-2xl tracking-[0.5em]"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div className="mb-6">
              <label className="block text-white/70 text-sm mb-2">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setConfirmPin(v) }}
                placeholder="••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors text-center text-2xl tracking-[0.5em]"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-3.5 rounded-full font-bold text-base cursor-pointer border-none disabled:opacity-50"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </>
        )}

        <button
          onClick={() => setLocation('/login')}
          className="w-full mt-4 text-sm text-white/40 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
        >
          Already have an account? Sign in →
        </button>
      </div>
    </div>
  )
}
