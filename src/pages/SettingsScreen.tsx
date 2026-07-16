import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'wouter'
import {
  getMe,
  logoutUser,
  changePassword,
  updateProfile,
  getBiometricsStatus,
  updateBiometrics,
} from '../api/client'
import { isBiometricAvailable, verifyBiometric, getBiometricEnabled, setBiometricEnabled, storeCredentialsWithBiometric, deleteBiometricCredentials } from '../utils/biometric'
import { getToken, setToken } from '../utils/tokenCache'
import { secureGet, secureSet } from '../utils/secureStorage'

const COLORS = {
  darkNavy: '#0B1120',
  navy: '#1B2A49',
  teal: '#4FD1C5',
  teal2: '#38B2AC',
  amber: '#F6B73C',
  red: '#FF5A5F',
  green: '#22C55E',
  g2: '#94A3B8',
}

interface UserProfile {
  id?: string
  name: string
  email: string
  phone: string
  region: string
  role: string
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function getPath(path: string): string {
  const saved = localStorage.getItem('carei_current_tenant')
  if (saved) {
    try {
      const t = JSON.parse(saved)
      if (t?.slug) return `/tenant/${t.slug}${path}`
    } catch { /* ignore */ }
  }
  return path
}

export default function SettingsScreen() {
  const [, setLocation] = useLocation()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Profile form
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRegion, setEditRegion] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Biometrics
  const [biometricsEnabled, setBiometricsEnabled] = useState(false)
  const [biometricsLoading, setBiometricsLoading] = useState(false)

  // Face recognition (placeholder)
  const [faceRecognition, setFaceRecognition] = useState(false)

  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('carei_notifications') !== 'false'
  })

  // Dark mode (placeholder - stored in localStorage)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('carei_dark_mode') === 'true'
  })

  useEffect(() => {
    (async () => {
      let token = getToken()
      if (!token) {
        token = await secureGet('token')
        if (token) setToken(token)
      }
      if (!token) {
        setLocation('/login?redirect=/settings')
        return
      }
      getMe()
      .then((data) => {
        if (data.user) {
          setUser(data.user)
          setEditName(data.user.name || '')
          setEditPhone(data.user.phone || '')
          setEditRegion(data.user.region || '')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    getBiometricsStatus()
      .then((data) => {
        // Prefer localStorage flag for native app biometric state
        setBiometricsEnabled(getBiometricEnabled() || data.enabled || false)
      })
      .catch(() => {
        setBiometricsEnabled(getBiometricEnabled())
      })
    })()
  }, [])

  const handleSaveProfile = async () => {
    setError('')
    setMsg('')
    setSavingProfile(true)
    try {
      const res = await updateProfile({
        name: editName,
        phone: editPhone,
        region: editRegion,
      })
      if (res.user) {
        setUser(res.user)
        const userJson = JSON.stringify(res.user)
        secureSet('user', userJson).catch(() => {})
      }
      setMsg('Profile updated successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    setError('')
    setMsg('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setMsg('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleToggleBiometrics = async () => {
    setBiometricsLoading(true)
    setError('')
    setMsg('')
    try {
      const next = !biometricsEnabled
      if (next) {
        // Check if running in Capacitor native app
        const isNative = typeof window !== 'undefined' && 'Capacitor' in window
        if (!isNative) {
          setError('Biometric login is only available in the native CAREi app (Android/iOS). On web, use PIN login instead.')
          setBiometricsLoading(false)
          return
        }
        // Enrolling: verify device supports biometric and user can authenticate
        const available = await isBiometricAvailable()
        if (!available) {
          setError('Biometric authentication is not available on this device.')
          setBiometricsLoading(false)
          return
        }
        const verified = await verifyBiometric('Confirm your identity to enable biometric login')
        if (!verified) {
          setError('Biometric verification failed. Please try again.')
          setBiometricsLoading(false)
          return
        }
        // Store current token securely for future biometric login
        const token = getToken()
        if (!token) {
          setError('No active session token found. Please re-login and try again.')
          setBiometricsLoading(false)
          return
        }
        if (user?.email) {
          const stored = await storeCredentialsWithBiometric(user.email, token)
          if (!stored) {
            setError('Failed to store biometric credentials. Please try again.')
            setBiometricsLoading(false)
            return
          }
        } else {
          setError('User email not found. Cannot store biometric credentials.')
          setBiometricsLoading(false)
          return
        }
      } else {
        await deleteBiometricCredentials()
      }
      await updateBiometrics({ enabled: next })
      setBiometricEnabled(next)
      setBiometricsEnabled(next)
      setMsg(next ? 'Biometric login enabled' : 'Biometric login disabled')
    } catch (err: any) {
      setError(err.message || 'Failed to update biometrics')
    } finally {
      setBiometricsLoading(false)
    }
  }

  const handleToggleNotifications = () => {
    const next = !notificationsEnabled
    setNotificationsEnabled(next)
    localStorage.setItem('carei_notifications', String(next))
    setMsg(next ? 'Notifications enabled' : 'Notifications disabled')
  }

  const handleToggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('carei_dark_mode', String(next))
    setMsg(next ? 'Dark mode enabled' : 'Dark mode disabled')
  }

  const handleLogout = async () => {
    try { await logoutUser() } catch { /* ignore */ }
    setLocation('/login')
  }

  const Section = ({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
        {icon}
        <h3 className="font-bold text-sm text-slate-800">{title}</h3>
      </div>
      <div className="p-5 flex flex-col gap-4">{children}</div>
    </motion.div>
  )

  const ToggleRow = ({ label, description, checked, onChange, disabled }: {
    label: string
    description?: string
    checked: boolean
    onChange: () => void
    disabled?: boolean
  }) => (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {description && <div className="text-[11px] text-slate-400 mt-0.5">{description}</div>}
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className="relative w-11 h-6 rounded-full transition-colors cursor-pointer border-none"
        style={{ background: checked ? COLORS.teal : '#E2E8F0' }}
      >
        <motion.div
          className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.darkNavy }}>
        <div className="w-10 h-10 border-2 border-teal border-t-transparent rounded-full animate-spin" style={{ borderColor: `${COLORS.teal} transparent transparent transparent` }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans items-center">
      <div className="w-full max-w-3xl flex flex-col min-h-screen">
        {/* Header */}
        <div
          className="px-6 pt-5 pb-5 text-white shrink-0 relative overflow-hidden"
          style={{ background: `linear-gradient(160deg, ${COLORS.darkNavy} 0%, ${COLORS.navy} 100%)` }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-15 pointer-events-none" style={{ background: COLORS.teal }} />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setLocation(getPath('/dashboard'))}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all bg-transparent border-none cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </motion.button>
              <div>
                <div className="text-sm font-bold">Settings</div>
                <div className="text-[11px] text-white/40">Account & Preferences</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-auto">
          {/* Status messages */}
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 text-sm text-teal-700"
            >
              {msg}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600"
            >
              {error}
            </motion.div>
          )}

          {/* Profile Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
              style={{ background: `linear-gradient(135deg, ${COLORS.teal}25, ${COLORS.teal2}15)`, color: COLORS.teal }}
            >
              {user ? getInitials(user.name) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-800 truncate">{user?.name || 'User'}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email}</div>
              <div className="text-[10px] text-slate-400 capitalize mt-0.5">{user?.role || 'Carer'}</div>
            </div>
          </div>

          {/* Profile Section */}
          <Section
            title="Profile"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            }
          >
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] text-slate-400 font-medium mb-1 block">Full Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium mb-1 block">Phone</label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium mb-1 block">Region</label>
                <input
                  value={editRegion}
                  onChange={(e) => setEditRegion(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal"
                  placeholder="Region / Location"
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})` }}
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </motion.button>
            </div>
          </Section>

          {/* Security Section */}
          <Section
            title="Security"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            }
          >
            <div className="flex flex-col gap-4">
              {/* Change Password */}
              <div className="flex flex-col gap-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Change Password</div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal"
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                  style={{ background: COLORS.navy }}
                >
                  {savingPassword ? 'Changing...' : 'Change Password'}
                </motion.button>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Biometrics */}
              <ToggleRow
                label="Biometric Login"
                description="Use fingerprint or face unlock to log in"
                checked={biometricsEnabled}
                onChange={handleToggleBiometrics}
                disabled={biometricsLoading}
              />

              {/* Face Recognition */}
              <ToggleRow
                label="Face Recognition"
                description="Quick login with face scan (WebAuthn)"
                checked={faceRecognition}
                onChange={() => {
                  setFaceRecognition(!faceRecognition)
                  setMsg(faceRecognition ? 'Face recognition disabled' : 'Face recognition enabled')
                }}
              />
            </div>
          </Section>

          {/* Preferences Section */}
          <Section
            title="Preferences"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            }
          >
            <div className="flex flex-col gap-4">
              <ToggleRow
                label="Push Notifications"
                description="Get alerts for visits, SOS and reminders"
                checked={notificationsEnabled}
                onChange={handleToggleNotifications}
              />
              <ToggleRow
                label="Dark Mode"
                description="Use dark theme throughout the app"
                checked={darkMode}
                onChange={handleToggleDarkMode}
              />
            </div>
          </Section>

          {/* About */}
          <Section
            title="About"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            }
          >
            <div className="flex flex-col gap-2 text-sm text-slate-600">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">App Version</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Build</span>
                <span className="font-medium">2025.06</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Platform</span>
                <span className="font-medium">Web / PWA</span>
              </div>
            </div>
          </Section>

          {/* Log Out */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white border-none cursor-pointer"
            style={{ background: COLORS.red }}
          >
            Log Out
          </motion.button>

          <div className="h-4" />
        </div>
      </div>
    </div>
  )
}
