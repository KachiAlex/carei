import { lazy, Suspense } from 'react'
import { Route, Router } from 'wouter'
import { useOnlineSync } from './hooks/useOnlineSync'

const SplashScreen = lazy(() => import('./pages/SplashScreen'))
const LoginScreen = lazy(() => import('./pages/LoginScreen'))
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

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1a2e' }}>
      <div className="w-10 h-10 border-2 border-teal border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function App() {
  useOnlineSync()
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Route path="/" component={SplashScreen} />
        <Route path="/login" component={LoginScreen} />
        <Route path="/dashboard" component={CarerDashboard} />
        <Route path="/visit/:id" component={ActiveVisitScreen} />
        <Route path="/summary/:id" component={VisitSummaryScreen} />
        <Route path="/copilot" component={AICopilotScreen} />
        <Route path="/manager/add-carer" component={CreateAccountScreen} />
        <Route path="/manager/login" component={ManagerLoginScreen} />
        <Route path="/manager" component={ManagerDashboard} />
        <Route path="/client/:id/overview" component={ClientOverviewScreen} />
        <Route path="/client/:id/care-plan" component={CarePlanScreen} />
        <Route path="/client/:id/history" component={VisitHistoryScreen} />
        <Route path="/manager/clients" component={ClientManagement} />
        <Route path="/manager/schedule" component={VisitScheduling} />
        <Route path="/manager/approvals" component={ManagerApprovalsScreen} />
        <Route path="/body-map/:visitId" component={BodyMapScreen} />
        <Route path="/emergency" component={EmergencyScreen} />
        <Route path="/rota" component={RotaScreen} />
        <Route path="/operations" component={OperationsScreen} />
        <Route path="/family/:id" component={FamilyPortalScreen} />
        <Route path="/family-summary/:id" component={FamilySummaryScreen} />
        <Route path="/admin" component={AdminTeaserScreen} />
      </Suspense>
    </Router>
  )
}

export default App
