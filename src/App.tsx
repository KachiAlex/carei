import { lazy, Suspense, useEffect, useState } from 'react'
import { Route, Router, Switch, useLocation } from 'wouter'
import SplashScreen from './pages/SplashScreen'
import { useOnlineSync } from './hooks/useOnlineSync'
import { useRemoteWipe } from './hooks/useRemoteWipe'
import { useDataMinimisation } from './hooks/useDataMinimisation'
import { TenantProvider } from './contexts/TenantContext'
import { secureGet, secureWipe } from './utils/secureStorage'
import { setToken, setRefreshToken, setUser, clearAuthCache } from './utils/tokenCache'
import { useAutoLock } from './hooks/useAutoLock'
const PWAInstallPrompt = lazyLoad(() => import('./components/PWAInstallPrompt'))
const SyncStatus = lazyLoad(() => import('./components/SyncStatus'))

function lazyLoad<T extends React.ComponentType<any>>(importFn: () => Promise<{ default: T }>): React.LazyExoticComponent<T> {
  return lazy(() =>
    importFn().catch((err) => {
      if (err.message?.includes('Failed to fetch dynamically imported module') || err.message?.includes('text/html')) {
        console.error('[lazyLoad] Stale chunk detected, reloading page...', err.message)
        window.location.reload()
      }
      throw err
    })
  )
}

function useReducedMotion() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      document.documentElement.classList.toggle('reduce-motion', mq.matches)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
}

// Decode JWT payload without verification (for expiry check)
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function useSecureBoot() {
  useEffect(() => {
    // Load encrypted auth data into memory cache on boot
    secureGet('token').then((token) => {
      if (token) {
        // Check expiry before accepting token
        const payload = decodeJwtPayload(token)
        if (payload?.exp && payload.exp * 1000 < Date.now()) {
          // Access token expired — try to refresh using refresh token
          secureGet('refreshToken').then((refreshToken) => {
            if (refreshToken) {
              setRefreshToken(refreshToken)
            } else {
              secureWipe()
              clearAuthCache()
            }
          })
          return
        }
        setToken(token)
      }
    })
    secureGet('refreshToken').then((refreshToken) => {
      if (refreshToken) setRefreshToken(refreshToken)
    })
    secureGet('user').then((user) => {
      if (user) setUser(user)
    })
  }, [])
}

function useClipboardGuard() {
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        // Clear clipboard when app goes to background
        try {
          if ('clipboard' in navigator) {
            navigator.clipboard.writeText('').catch(() => {})
          }
        } catch {}
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
}

const OnboardingScreen = lazyLoad(() => import('./pages/OnboardingScreen'))
const LoginScreen = lazyLoad(() => import('./pages/LoginScreen'))
const TenantSelectScreen = lazyLoad(() => import('./pages/TenantSelectScreen'))
const CarerDashboard = lazyLoad(() => import('./pages/CarerDashboard'))
const ActiveVisitScreen = lazyLoad(() => import('./pages/ActiveVisitScreen'))
const AICopilotScreen = lazyLoad(() => import('./pages/AICopilotScreen'))
const VisitSummaryScreen = lazyLoad(() => import('./pages/VisitSummaryScreen'))
const ManagerLoginScreen = lazyLoad(() => import('./pages/ManagerLoginScreen'))
const ManagerDashboard = lazyLoad(() => import('./pages/ManagerDashboard'))
const ClientManagement = lazyLoad(() => import('./pages/ClientManagement'))
const VisitScheduling = lazyLoad(() => import('./pages/VisitScheduling'))
const ClientOverviewScreen = lazyLoad(() => import('./pages/ClientOverviewScreen'))
const CreateAccountScreen = lazyLoad(() => import('./pages/CreateAccountScreen'))
const BodyMapScreen = lazyLoad(() => import('./pages/BodyMapScreen'))
const CarePlanScreen = lazyLoad(() => import('./pages/CarePlanScreen'))
const EmergencyScreen = lazyLoad(() => import('./pages/EmergencyScreen'))
const VisitHistoryScreen = lazyLoad(() => import('./pages/VisitHistoryScreen'))
const RotaScreen = lazyLoad(() => import('./pages/RotaScreen'))
const OperationsScreen = lazyLoad(() => import('./pages/OperationsScreen'))
const FamilyPortalScreen = lazyLoad(() => import('./pages/FamilyPortalScreen'))
const FamilyLoginScreen = lazyLoad(() => import('./pages/FamilyLoginScreen'))
const FamilyDashboardScreen = lazyLoad(() => import('./pages/FamilyDashboardScreen'))
const FamilySettingsScreen = lazyLoad(() => import('./pages/FamilySettingsScreen'))
const ManagerApprovalsScreen = lazyLoad(() => import('./pages/ManagerApprovalsScreen'))
const ManagerAuditScreen = lazyLoad(() => import('./pages/ManagerAuditScreen'))
const FamilySummaryScreen = lazyLoad(() => import('./pages/FamilySummaryScreen'))
const AdminTeaserScreen = lazyLoad(() => import('./pages/AdminTeaserScreen'))
const SuperAdminScreen = lazyLoad(() => import('./pages/SuperAdminScreen'))
const AcceptInviteScreen = lazyLoad(() => import('./pages/AcceptInviteScreen'))
const TenantMembersScreen = lazyLoad(() => import('./pages/TenantMembersScreen'))
const SettingsScreen = lazyLoad(() => import('./pages/SettingsScreen'))
const AvailabilityScreen = lazyLoad(() => import('./pages/AvailabilityScreen'))
const DbsScreen = lazyLoad(() => import('./pages/DbsScreen'))
const TrainingScreen = lazyLoad(() => import('./pages/TrainingScreen'))
const RightToWorkScreen = lazyLoad(() => import('./pages/RightToWorkScreen'))
const SupervisionScreen = lazyLoad(() => import('./pages/SupervisionScreen'))
const MessagesScreen = lazyLoad(() => import('./pages/MessagesScreen'))
const ManagerCarePlanEditScreen = lazyLoad(() => import('./pages/ManagerCarePlanEditScreen'))
const EnhancedManagerCarePlanEditScreen = lazyLoad(() => import('./pages/EnhancedManagerCarePlanEditScreen'))
const FinalEnhancedCarePlanEditScreen = lazyLoad(() => import('./pages/FinalEnhancedCarePlanEditScreen'))
const AIReportScreen = lazyLoad(() => import('./pages/AIReportScreen'))
const ComplianceDashboardScreen = lazyLoad(() => import('./pages/ComplianceDashboardScreen'))
const RiskAlertsScreen = lazyLoad(() => import('./pages/RiskAlertsScreen'))
const StaffMatchingScreen = lazyLoad(() => import('./pages/StaffMatchingScreen'))

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1a2e' }}>
      <div className="w-10 h-10 border-2 border-teal border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function HomeOrSplash() {
  return <SplashScreen />
}

// Routes that are NOT wrapped in TenantProvider
function PublicRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeOrSplash} />
      <Route path="/onboarding" component={OnboardingScreen} />
      <Route path="/login" component={LoginScreen} />
      <Route path="/select-tenant" component={TenantSelectScreen} />
      <Route path="/manager/login" component={ManagerLoginScreen} />
      <Route path="/family/login" component={FamilyLoginScreen} />
      <Route path="/family/dashboard" component={FamilyDashboardScreen} />
      <Route path="/family/settings" component={FamilySettingsScreen} />
      <Route path="/admin" component={AdminTeaserScreen} />
      <Route path="/super-admin" component={SuperAdminScreen} />
      <Route path="/join" component={AcceptInviteScreen} />
      {/* Legacy routes - redirect to tenant routes after login */}
      <Route path="/dashboard" component={CarerDashboard} />
      <Route path="/visit/:id" component={ActiveVisitScreen} />
      <Route path="/summary/:id" component={VisitSummaryScreen} />
      <Route path="/body-map/:visitId" component={BodyMapScreen} />
      <Route path="/copilot" component={AICopilotScreen} />
      <Route path="/history" component={VisitHistoryScreen} />
      <Route path="/client/:id/overview" component={ClientOverviewScreen} />
      <Route path="/client/:id/care-plan" component={CarePlanScreen} />
      <Route path="/client/:id/history" component={VisitHistoryScreen} />
      <Route path="/settings" component={SettingsScreen} />
      <Route path="/availability" component={AvailabilityScreen} />
      <Route path="/messages" component={MessagesScreen} />
    </Switch>
  )
}

// Routes that ARE wrapped in TenantProvider (tenant-aware)
function TenantRoutes() {
  const [location] = useLocation()
  if (!location.startsWith('/tenant/')) return null
  return (
    <TenantProvider>
      <Switch>
        {/* Tenant-prefixed routes */}
        <Route path="/tenant/:slug/dashboard" component={CarerDashboard} />
        <Route path="/tenant/:slug/visit/:id" component={ActiveVisitScreen} />
        <Route path="/tenant/:slug/summary/:id" component={VisitSummaryScreen} />
        <Route path="/tenant/:slug/copilot" component={AICopilotScreen} />
        <Route path="/tenant/:slug/client/:id/overview" component={ClientOverviewScreen} />
        <Route path="/tenant/:slug/client/:id/care-plan" component={CarePlanScreen} />
        <Route path="/tenant/:slug/client/:id/history" component={VisitHistoryScreen} />
        <Route path="/tenant/:slug/body-map/:visitId" component={BodyMapScreen} />
        <Route path="/tenant/:slug/emergency" component={EmergencyScreen} />
        <Route path="/tenant/:slug/rota" component={RotaScreen} />
        <Route path="/tenant/:slug/operations" component={OperationsScreen} />
        <Route path="/tenant/:slug/family/:id" component={FamilyPortalScreen} />
        <Route path="/tenant/:slug/family-summary/:id" component={FamilySummaryScreen} />

        {/* Manager routes within tenant */}
        <Route path="/tenant/:slug/manager" component={ManagerDashboard} />
        <Route path="/tenant/:slug/manager/clients" component={ClientManagement} />
        <Route path="/tenant/:slug/manager/clients/:id/care-plan/edit" component={ManagerCarePlanEditScreen} />
        <Route path="/tenant/:slug/manager/clients/:id/care-plan/enhanced" component={EnhancedManagerCarePlanEditScreen} />
        <Route path="/tenant/:slug/manager/clients/:id/care-plan/final" component={FinalEnhancedCarePlanEditScreen} />
        <Route path="/tenant/:slug/manager/schedule" component={VisitScheduling} />
        <Route path="/tenant/:slug/manager/approvals" component={ManagerApprovalsScreen} />
        <Route path="/tenant/:slug/manager/audit" component={ManagerAuditScreen} />
        <Route path="/tenant/:slug/manager/reports" component={AIReportScreen} />
        <Route path="/tenant/:slug/manager/compliance" component={ComplianceDashboardScreen} />
        <Route path="/tenant/:slug/manager/risk-alerts" component={RiskAlertsScreen} />
        <Route path="/tenant/:slug/manager/staff-matching" component={StaffMatchingScreen} />
        <Route path="/tenant/:slug/manager/add-carer" component={CreateAccountScreen} />
        <Route path="/tenant/:slug/manager/members" component={TenantMembersScreen} />
        <Route path="/tenant/:slug/settings" component={SettingsScreen} />
        <Route path="/tenant/:slug/availability" component={AvailabilityScreen} />
        <Route path="/tenant/:slug/dbs" component={DbsScreen} />
        <Route path="/tenant/:slug/training" component={TrainingScreen} />
        <Route path="/tenant/:slug/right-to-work" component={RightToWorkScreen} />
        <Route path="/tenant/:slug/supervisions" component={SupervisionScreen} />
        <Route path="/tenant/:slug/messages" component={MessagesScreen} />
      </Switch>
    </TenantProvider>
  )
}

function AutoLockGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation()
  useAutoLock({
    onLock: () => {
      clearAuthCache()
      secureWipe().catch(() => {})
      if (!window.location.pathname.includes('/login')) {
        setLocation('/login')
      }
    },
  })
  return <>{children}</>
}

function App() {
  useReducedMotion()
  useSecureBoot()
  useClipboardGuard()
  useOnlineSync()
  useDataMinimisation()
  const { wiping, wipeReason } = useRemoteWipe()

  if (wiping) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#0f1a2e' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,90,95,0.1)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF5A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </div>
        <div className="text-white font-bold text-lg mb-2">Remote Wipe in Progress</div>
        <div className="text-white/50 text-sm mb-4 text-center max-w-xs px-4">
          {wipeReason || 'This device has been remotely wiped by your administrator.'}
        </div>
        <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-white/30 text-xs mt-4">Redirecting to login...</div>
      </div>
    )
  }

  return (
    <Router>
      <AutoLockGuard>
        <Suspense fallback={<LoadingFallback />}>
          <SyncStatus />
          <PublicRoutes />
          <TenantRoutes />
          <PWAInstallPrompt />
        </Suspense>
      </AutoLockGuard>
    </Router>
  )
}

export default App
