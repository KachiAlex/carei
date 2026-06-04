import { lazy, Suspense } from 'react'
import { Route, Router } from 'wouter'
import { useOnlineSync } from './hooks/useOnlineSync'

const SplashScreen = lazy(() => import('./pages/SplashScreen'))
const LoginScreen = lazy(() => import('./pages/LoginScreen'))
const OTPScreen = lazy(() => import('./pages/OTPScreen'))
const CarerDashboard = lazy(() => import('./pages/CarerDashboard'))
const ActiveVisitScreen = lazy(() => import('./pages/ActiveVisitScreen'))
const AICopilotScreen = lazy(() => import('./pages/AICopilotScreen'))
const VisitSummaryScreen = lazy(() => import('./pages/VisitSummaryScreen'))
const ManagerLoginScreen = lazy(() => import('./pages/ManagerLoginScreen'))
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'))

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
        <Route path="/otp" component={OTPScreen} />
        <Route path="/dashboard" component={CarerDashboard} />
        <Route path="/visit/:id" component={ActiveVisitScreen} />
        <Route path="/summary/:id" component={VisitSummaryScreen} />
        <Route path="/copilot" component={AICopilotScreen} />
        <Route path="/manager/login" component={ManagerLoginScreen} />
        <Route path="/manager" component={ManagerDashboard} />
      </Suspense>
    </Router>
  )
}

export default App
