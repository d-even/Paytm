import { Navigate, Outlet } from 'react-router-dom'
import { Login } from '../../pages/Login'
import { LoginOtp } from '../../pages/LoginOtp'
import { Onboarding } from '../../pages/Onboarding'
import { useSession } from '../../store/session'

/** Signed-in and onboarded merchants only; everyone else is sent to the right step. */
export function RequireMerchant() {
  const { signedIn, onboarded } = useSession()
  if (!signedIn) return <Navigate to="/login" replace />
  if (!onboarded) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

export function LoginRoute() {
  const signedIn = useSession((s) => s.signedIn)
  return signedIn ? <Navigate to="/" replace /> : <Login />
}

/** The OTP screen needs a number to verify; without one, go back and ask for it. */
export function LoginOtpRoute() {
  const signedIn = useSession((s) => s.signedIn)
  const pending = useSession((s) => s.pendingOtp)
  if (signedIn) return <Navigate to="/" replace />
  if (!pending) return <Navigate to="/login" replace />
  return <LoginOtp pending={pending} />
}

export function OnboardingRoute() {
  const { signedIn, onboarded } = useSession()
  if (!signedIn) return <Navigate to="/login" replace />
  return onboarded ? <Navigate to="/" replace /> : <Onboarding />
}
