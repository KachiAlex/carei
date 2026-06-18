import { useState, useEffect } from 'react'
import { useLocation, useSearch } from 'wouter'
import { motion } from 'framer-motion'
import { API_BASE } from '../api/client'
import { getToken } from '../utils/tokenCache'

interface InviteDetails {
  valid: boolean
  tenantSlug: string
  tenantName: string
  role: string
  email: string
}

export default function AcceptInviteScreen() {
  const [, setLocation] = useLocation()
  const search = useSearch()
  const [inviteCode, setInviteCode] = useState('')
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Extract code from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(search)
    const code = params.get('code')
    if (code) {
      setInviteCode(code)
      verifyInvite(code)
    }
  }, [search])

  const verifyInvite = async (code: string) => {
    if (!code.trim()) return

    try {
      setIsVerifying(true)
      setError(null)

      const res = await fetch(`${API_BASE}/invites?code=${code}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Invalid invite code')
      }

      setInviteDetails(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const acceptInvite = async () => {
    const token = getToken()
    if (!token) {
      // Redirect to login with return URL
      localStorage.setItem('carei_pending_invite', inviteCode)
      setLocation(`/login?redirect=/join?code=${inviteCode}`)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch(`${API_BASE}/invites`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: inviteCode })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept invite')
      }

      setSuccess(true)
      localStorage.removeItem('carei_pending_invite')

      // Redirect to the tenant dashboard after a short delay
      setTimeout(() => {
        if (inviteDetails?.tenantSlug) {
          setLocation(`/tenant/${inviteDetails.tenantSlug}/dashboard`)
        } else {
          setLocation('/select-tenant')
        }
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verifyInvite(inviteCode)
  }

  // Show success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0B1120' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to {inviteDetails?.tenantName}!</h1>
          <p className="text-white/60">You've successfully joined the organization.</p>
          <p className="text-white/40 text-sm mt-4">Redirecting to dashboard...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#0B1120' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto pt-12"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎟️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Join Organization</h1>
          <p className="text-white/60 text-sm">
            Enter your invite code to join a care organization
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {!inviteDetails ? (
          // Code entry form
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs mb-2 block">Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code (e.g., ABC123)"
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-lg tracking-wider uppercase placeholder:text-white/30 placeholder:normal-case placeholder:text-sm focus:border-teal-400 focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || inviteCode.length < 4}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 text-slate-900 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isVerifying ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={() => setLocation('/login')}
              className="w-full py-3 rounded-xl text-white/40 hover:text-white/60 text-sm transition-colors"
            >
              Back to login
            </button>
          </form>
        ) : (
          // Invite details and accept
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-2xl mx-auto mb-3">
                🏥
              </div>
              <h2 className="text-xl font-bold text-white">{inviteDetails.tenantName}</h2>
              <p className="text-white/40 text-sm">carei.com/tenant/{inviteDetails.tenantSlug}</p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Role</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  inviteDetails.role === 'admin'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-teal-500/20 text-teal-400'
                }`}>
                  {inviteDetails.role}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Email</span>
                <span className="text-white">{inviteDetails.email}</span>
              </div>
            </div>

            <button
              onClick={acceptInvite}
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 text-slate-900 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Joining...' : 'Join Organization'}
            </button>

            <button
              onClick={() => {
                setInviteDetails(null)
                setInviteCode('')
                setError(null)
              }}
              className="w-full py-3 rounded-xl text-white/40 hover:text-white/60 text-sm transition-colors mt-2"
            >
              Use different code
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
