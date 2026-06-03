import { Route, Router } from 'wouter'
import SplashScreen from './pages/SplashScreen'
import LoginScreen from './pages/LoginScreen'
import OTPScreen from './pages/OTPScreen'
import CarerDashboard from './pages/CarerDashboard'
import ActiveVisitScreen from './pages/ActiveVisitScreen'
import AICopilotScreen from './pages/AICopilotScreen'
import VisitSummaryScreen from './pages/VisitSummaryScreen'
import ManagerLoginScreen from './pages/ManagerLoginScreen'
import ManagerDashboard from './pages/ManagerDashboard'

function App() {
  return (
    <Router>
      <Route path="/" component={SplashScreen} />
      <Route path="/login" component={LoginScreen} />
      <Route path="/otp" component={OTPScreen} />
      <Route path="/dashboard" component={CarerDashboard} />
      <Route path="/visit/:id" component={ActiveVisitScreen} />
      <Route path="/summary/:id" component={VisitSummaryScreen} />
      <Route path="/copilot" component={AICopilotScreen} />
      <Route path="/manager/login" component={ManagerLoginScreen} />
      <Route path="/manager" component={ManagerDashboard} />
    </Router>
  )
}

export default App
