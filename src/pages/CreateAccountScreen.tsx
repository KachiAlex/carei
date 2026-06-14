import { useState, useRef } from 'react'
import { useLocation } from 'wouter'
import { registerUser } from '../api/client'
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

// PIN digit boxes component
function PinBoxes({ pin, onChange }: { pin: string[]; onChange: (i: number, val: string) => void }) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(0, 1)
    if (digit || val === '') {
      onChange(i, digit)
      if (digit && i < 3) {
        refs[i + 1].current?.focus()
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

export default function CreateAccountScreen() {
  const [, setLocation] = useLocation()
  const [step, setStep] = useState<'name' | 'role' | 'pin' | 'done'>('name')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [agency, setAgency] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [pin, setPin] = useState(['', '', '', ''])
  const [confirmPin, setConfirmPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const stepLabels = ['Details', 'Your role', 'Set PIN']
  const stepIndex = step === 'name' ? 0 : step === 'role' ? 1 : step === 'pin' ? 2 : 2

  const getInitials = (name: string) => {
    return name.trim().split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  const handleNameNext = () => {
    setError('')
    if (!fullName.trim()) { setError('Please enter your full name.'); return }
    if (!validateEmail(email)) { setError('Please enter a valid email address.'); return }
    if (!agency.trim()) { setError('Please enter your agency name.'); return }
    setStep('role')
  }

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role)
    setStep('pin')
  }

  const handleCreate = async () => {
    const pinValue = pin.join('')
    if (pinValue.length !== 4) { setError('Please enter all 4 digits.'); return }
    if (pinValue !== confirmPin.join('')) { setError('PINs do not match.'); return }
    
    setError('')
    setLoading(true)
    
    // Register via API
    try {
      await registerUser({
        id: crypto.randomUUID?.() || `u-${Date.now()}`,
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: '',
        region: agency.trim(),
        role: selectedRole || 'carer',
        pin: pinValue,
      })
      setStep('done')
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
      setLoading(false)
      return
    }
    setLoading(false)
    
    setTimeout(() => {
      const role = selectedRole || 'carer'
      setLocation(role === 'manager' ? '/manager' : '/dashboard')
    }, 2500)
  }

  const handlePinChange = (idx: number, val: string) => {
    const next = [...pin]
    next[idx] = val
    setPin(next)
    setError('')
  }

  const handleConfirmPinChange = (idx: number, val: string) => {
    const next = [...confirmPin]
    next[idx] = val
    setConfirmPin(next)
    setError('')
  }

  const handleBack = () => {
    if (step === 'pin') setStep('role')
    else if (step === 'role') setStep('name')
    else setLocation('/')
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans overflow-y-auto"
      style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
    >
      <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full py-8">
        {/* Progress bar */}
        {step !== 'done' && (
          <div className="flex gap-0 mb-8">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  className="w-full h-1 rounded-full transition-colors"
                  style={{ background: i <= stepIndex ? COLORS.teal : 'rgba(255,255,255,0.1)' }}
                />
                <span 
                  className="text-[10px] font-medium"
                  style={{ color: i <= stepIndex ? COLORS.teal : COLORS.g2 }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {step !== 'done' && (
          <button
            onClick={handleBack}
            className="self-start mb-6 text-white/60 hover:text-white transition-colors text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer py-1 px-1 -ml-1 rounded-lg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
        )}

        {/* STEP 1: Details */}
        {step === 'name' && (
          <>
            <div className="text-center mb-8">
              <h1 className="font-serif text-white text-2xl mb-2">CARE<span style={{ color: COLORS.teal }}>i</span></h1>
              <h2 className="font-serif text-white text-xl">Create your account</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-2 font-medium">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleNameNext()}
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-2 font-medium">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleNameNext()}
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-2 font-medium">Agency name</label>
                <input
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  placeholder="Enter your agency name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 outline-none focus:border-teal transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleNameNext()}
                />
              </div>
            </div>
            
            {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
            
            <button
              onClick={handleNameNext}
              className="w-full py-3.5 rounded-xl font-bold text-base cursor-pointer border-none mt-6"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              Continue →
            </button>
            
            <button
              onClick={() => setLocation('/login')}
              className="w-full mt-4 text-sm text-white/40 bg-transparent border-none cursor-pointer hover:text-white transition-colors"
            >
              Already have an account? Log in
            </button>
          </>
        )}

        {/* STEP 2: Role Selection */}
        {step === 'role' && (
          <>
            <div className="text-center mb-6">
              <p className="text-white/50 text-sm">How will you be using CAREi?</p>
            </div>
            
            <div className="space-y-4">
              {[
                { 
                  role: 'manager' as UserRole, 
                  icon: '🏢', 
                  title: 'I manage a care team', 
                  sub: 'Set up your agency, invite carers, manage clients and approve shift summaries.', 
                  tags: ['Team Management', 'Client Allocation', 'Approvals'] 
                },
                { 
                  role: 'carer' as UserRole, 
                  icon: '👩‍⚕️', 
                  title: "I'm a care worker", 
                  sub: 'Access your schedule, complete visits, record medications and submit handovers.', 
                  tags: ['Visit Recording', 'Medication Log', 'AI Copilot'] 
                },
              ].map((opt) => (
                <button
                  key={opt.role}
                  onClick={() => handleRoleSelect(opt.role)}
                  className="w-full text-left rounded-2xl p-5 cursor-pointer transition-all"
                  style={{
                    background: selectedRole === opt.role ? 'rgba(79,209,197,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${selectedRole === opt.role ? 'rgba(79,209,197,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <div className="text-3xl mb-2">{opt.icon}</div>
                  <div className="text-white font-bold text-base mb-1">{opt.title}</div>
                  <div className="text-white/50 text-sm leading-relaxed mb-3">{opt.sub}</div>
                  <div className="flex gap-2 flex-wrap">
                    {opt.tags.map(t => (
                      <span 
                        key={t} 
                        className="text-[10px] font-bold px-2 py-1 rounded-full"
                        style={{ background: 'rgba(79,209,197,0.1)', color: COLORS.teal }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 3: PIN Setup */}
        {step === 'pin' && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-white font-semibold text-lg mb-1">Choose a 4-digit PIN</h2>
              <p className="text-white/50 text-sm">You'll use this to log in each time</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-white/50 text-xs mb-3 text-center uppercase tracking-wider">Enter PIN</label>
                <PinBoxes pin={pin} onChange={handlePinChange} />
              </div>
              
              <div>
                <label className="block text-white/50 text-xs mb-3 text-center uppercase tracking-wider">Confirm PIN</label>
                <PinBoxes pin={confirmPin} onChange={handleConfirmPinChange} />
              </div>
            </div>
            
            {error && <p className="text-red-400 text-sm mt-6 text-center">{error}</p>}
            
            <button
              onClick={handleCreate}
              disabled={loading || !pin.every(p => p) || !confirmPin.every(p => p)}
              className="w-full py-3.5 rounded-xl font-bold text-base cursor-pointer border-none disabled:opacity-50 mt-8"
              style={{ background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.teal2})`, color: COLORS.darkNavy }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </>
        )}

        {/* STEP 4: Avatar Reveal / Success */}
        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn">
            {/* Avatar with initials */}
            <div className="relative mb-6">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg"
                style={{ 
                  background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`,
                  color: COLORS.darkNavy,
                  boxShadow: `0 0 0 6px rgba(79,209,197,0.18), 0 0 0 12px rgba(79,209,197,0.07)`,
                }}
              >
                {getInitials(fullName) || '?'}
              </div>
              <div 
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center border-2"
                style={{ background: COLORS.green, borderColor: COLORS.darkNavy }}
              >
                <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
                  <polyline points="2,7 5,10 11,3" stroke={COLORS.darkNavy} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            
            <h2 className="text-white font-bold text-2xl mb-1">Welcome, {fullName.trim().split(' ')[0]}!</h2>
            <p className="text-white/50 mb-3">{agency.trim() || 'Your Agency'}</p>
            
            <div className="inline-flex gap-2 mb-6">
              <span 
                className="px-4 py-1.5 rounded-full text-xs font-bold"
                style={{ 
                  background: selectedRole === 'manager' ? 'rgba(79,209,197,0.15)' : 'rgba(255,255,255,0.08)', 
                  color: selectedRole === 'manager' ? COLORS.teal : COLORS.g2,
                  border: `1px solid ${selectedRole === 'manager' ? 'rgba(79,209,197,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {selectedRole === 'manager' ? '🏢 Agency Manager' : '👩‍⚕️ Care Worker'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-white/30 text-xs">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.teal, animationDelay: '0s' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.teal, animationDelay: '0.4s' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.teal, animationDelay: '0.8s' }} />
              </div>
              <span>Setting up your {selectedRole === 'manager' ? 'portal' : 'workspace'}…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
