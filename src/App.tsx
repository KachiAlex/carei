import { lazy, Suspense, useEffect } from 'react'
import { Route, Router, Switch } from 'wouter'
import { useOnlineSync } from './hooks/useOnlineSync'
import { TenantProvider } from './contexts/TenantContext'

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

const SplashScreen = lazy(() => import('./pages/SplashScreen'))
const LoginScreen = lazy(() => import('./pages/LoginScreen'))
const TenantSelectScreen = lazy(() => import('./pages/TenantSelectScreen'))
const CarerDashboard = lazy(() => import('./pages/CarerDashboard'))
const ActiveVisitScreen = lazy(() => import('./pages/ActiveVisitScreen'))
const AICopilotScreen = lazy(() => import('./pages/AICopilotScreen'))
const VisitSummaryScreen = lazy(() => import('./pages/VisitSummaryScreen'))
const ManagerLoginScreen = lazy(() => import('./pages/ManagerLoginScreen'))
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'))
const ClientManagement = lazy(() => import('./pages/ClientManagement'))
const VisitScheduling = lazy(() => import('./pages/VisitScheduling'))
const ClientOverviewScreen = lazy(() => import('./pages/ClientOverviewScreen'))
const CreateAccountScreen = lazy(() => import('./pages/CreateAccountScreen'))
const BodyMapScreen = lazy(() => import('./pages/BodyMapScreen'))
const CarePlanScreen = lazy(() => import('./pages/CarePlanScreen'))
const EmergencyScreen = lazy(() => import('./pages/EmergencyScreen'))
const VisitHistoryScreen = lazy(() => import('./pages/VisitHistoryScreen'))
const RotaScreen = lazy(() => import('./pages/RotaScreen'))
const OperationsScreen = lazy(() => import('./pages/OperationsScreen'))
const FamilyPortalScreen = lazy(() => import('./pages/FamilyPortalScreen'))
const ManagerApprovalsScreen = lazy(() => import('./pages/ManagerApprovalsScreen'))
const FamilySummaryScreen = lazy(() => import('./pages/FamilySummaryScreen'))
const AdminTeaserScreen = lazy(() => import('./pages/AdminTeaserScreen'))
const SuperAdminScreen = lazy(() => import('./pages/SuperAdminScreen'))
const AcceptInviteScreen = lazy(() => import('./pages/AcceptInviteScreen'))
const TenantMembersScreen = lazy(() => import('./pages/TenantMembersScreen'))
const SettingsScreen = lazy(() => import('./pages/SettingsScreen'))

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1a2e' }}>
      <div className="w-10 h-10 border-2 border-teal border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// Routes that are NOT wrapped in TenantProvider
function PublicRoutes() {
  return (
    <Switch>
      <Route path="/" component={SplashScreen} />
      <Route path="/login" component={LoginScreen} />
      <Route path="/select-tenant" component={TenantSelectScreen} />
      <Route path="/manager/login" component={ManagerLoginScreen} />
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
    </Switch>
  )
}

// Routes that ARE wrapped in TenantProvider (tenant-aware)
function TenantRoutes() {
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
        <Route path="/tenant/:slug/manager/schedule" component={VisitScheduling} />
        <Route path="/tenant/:slug/manager/approvals" component={ManagerApprovalsScreen} />
        <Route path="/tenant/:slug/manager/add-carer" component={CreateAccountScreen} />
        <Route path="/tenant/:slug/manager/members" component={TenantMembersScreen} />
        <Route path="/tenant/:slug/settings" component={SettingsScreen} />
      </Switch>
    </TenantProvider>
  )
}

function App() {
  useReducedMotion()
  useOnlineSync()
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <PublicRoutes />
        <TenantRoutes />
      </Suspense>
    </Router>
  )
}

export default App
