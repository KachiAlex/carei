import { useState, useEffect } from 'react'
import { useLocation, useRoute } from 'wouter'
import { motion } from 'framer-motion'
import { familyLogin, sendFamilyPasswordReset, isFamilyAuthenticated } from '../api/familyApi'
import { Eye, EyeOff, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  lavender: '#A78BFA',
}

export default function FamilyLoginScreen() {
  const [, setLocation] = useLocation()
  const [match, params] = useRoute('/family/login')
  
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  
  // PWA install prompt
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Redirect if already authenticated
    if (isFamilyAuthenticated()) {
      setLocation('/family/dashboard')
    }
    
    // Check if running as installed PWA
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
    
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallPrompt(true)
    }
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [setLocation])
  
  const handleInstallPWA = async () => {
    if (!deferredPrompt) return
    
    (deferredPrompt as any).prompt()
    const { outcome } = await (deferredPrompt as any).userChoice
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !pin.trim()) {
      setError('Please enter both email and PIN')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      await familyLogin({ email: email.trim(), pin: pin.trim() })
      setSuccess('Login successful! Redirecting...')
      setTimeout(() => {
        setLocation('/family/dashboard')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail.trim()) {
      setError('Please enter your email address')
      return
    }

    setResetLoading(true)
    setError('')
    
    try {
      await sendFamilyPasswordReset(resetEmail.trim())
      setSuccess('Password reset instructions sent to your email!')
      setTimeout(() => {
        setResetMode(false)
        setResetEmail('')
        setSuccess('')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset instructions. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  const handlePinChange = (value: string) => {
    // Only allow numbers, max 6 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 6)
    setPin(numericValue)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(135deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}>
      {/* Header */}
      <div className="p-4">
        <button
          onClick={() => setLocation('/')}
          className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={20} />
          Back to Home
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-3xl">👨‍👩‍👧‍👦</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Family Portal</h1>
            <p className="text-white/70">
              {resetMode ? 'Reset your PIN' : 'Access your loved one\'s care information'}
            </p>
          </div>

          {/* Login Form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-xl p-6"
          >
            {!resetMode ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                {/* PIN Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Security PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => handlePinChange(e.target.value)}
                      placeholder="Enter your 6-digit PIN"
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                      maxLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the 6-digit PIN provided by your care coordinator
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-red-700 text-sm">{error}</span>
                  </motion.div>
                )}

                {/* Success Message */}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <span className="text-green-700 text-sm">{success}</span>
                  </motion.div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-teal text-navy font-semibold rounded-lg hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>

                {/* Forgot PIN Link */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(true)
                      setError('')
                      setSuccess('')
                    }}
                    className="text-teal hover:text-teal/80 text-sm font-medium"
                  >
                    Forgot your PIN?
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                {/* Reset Email Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-transparent"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    We'll send you instructions to reset your PIN
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-red-700 text-sm">{error}</span>
                  </motion.div>
                )}

                {/* Success Message */}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <span className="text-green-700 text-sm">{success}</span>
                  </motion.div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 bg-teal text-navy font-semibold rounded-lg hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Instructions'}
                </button>

                {/* Back to Login */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(false)
                      setResetEmail('')
                      setError('')
                      setSuccess('')
                    }}
                    className="text-teal hover:text-teal/80 text-sm font-medium"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </motion.div>

          {/* Help Section */}
          <div className="mt-6 text-center">
            <p className="text-white/60 text-sm mb-2">
              Need help accessing your account?
            </p>
            <button
              onClick={() => setLocation('/support')}
              className="text-teal hover:text-teal/80 text-sm font-medium"
            >
              Contact Support
            </button>
          </div>

          {/* Security Notice */}
          <div className="mt-8 p-4 bg-white/10 rounded-lg backdrop-blur">
            <h3 className="text-white font-medium mb-2 text-sm">🔒 Secure Access</h3>
            <ul className="text-white/70 text-xs space-y-1">
              <li>• Your login information is encrypted and secure</li>
              <li>• You can only access information for your approved family members</li>
              <li>• All activity is logged for security purposes</li>
              <li>• Contact your care coordinator if you suspect unauthorized access</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
