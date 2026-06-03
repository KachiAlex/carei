import { Route, Router } from 'wouter'
import SplashScreen from './pages/SplashScreen'
import LoginScreen from './pages/LoginScreen'
import OTPScreen from './pages/OTPScreen'
import CarerDashboard from './pages/CarerDashboard'

function App() {
  return (
    <Router>
      <Route path="/" component={SplashScreen} />
      <Route path="/login" component={LoginScreen} />
      <Route path="/otp" component={OTPScreen} />
      <Route path="/dashboard" component={CarerDashboard} />
    </Router>
  )
}

export default App
