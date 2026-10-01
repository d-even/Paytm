import { createBrowserRouter, createHashRouter } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { AppShell } from './components/layout/AppShell'
import { LoginOtpRoute, LoginRoute, OnboardingRoute, RequireMerchant } from './components/layout/RouteGuards'
import { Actions } from './pages/Actions'
import { AskMitra } from './pages/AskMitra'
import { Campaigns } from './pages/Campaigns'
import { Credit } from './pages/Credit'
import { DesignSystem } from './pages/DesignSystem'
import { Counter } from './pages/Counter'
import { Impact } from './pages/Impact'
import { NotFound } from './pages/NotFound'
import { Regulars } from './pages/Regulars'
import { Settings } from './pages/Settings'

// Static builds (`npm run build:static`) can be opened from any host or folder,
// where deep links have no server fallback, so they use hash URLs (#/actions).
const createRouter = import.meta.env.MODE === 'static' ? createHashRouter : createBrowserRouter

export const router = createRouter([
  { path: '/login', element: <LoginRoute /> },
  { path: '/login/otp', element: <LoginOtpRoute /> },
  { path: '/onboarding', element: <OnboardingRoute /> },
  {
    // Internal reference page for the clay design system.
    path: '/design-system',
    element: (
      <>
        <Navbar />
        <DesignSystem />
      </>
    ),
  },
  {
    element: <RequireMerchant />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Counter /> },
          { path: 'actions', element: <Actions /> },
          { path: 'campaigns', element: <Campaigns /> },
          { path: 'credit', element: <Credit /> },
          { path: 'ask', element: <AskMitra /> },
          { path: 'regulars', element: <Regulars /> },
          { path: 'impact', element: <Impact /> },
          { path: 'settings', element: <Settings /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
