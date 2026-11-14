import { AuthProvider, LoginPage, useAuth } from '@/features/auth'
import { NavigationProvider } from '@/shared/navigation'
import { AppShell } from './layout/AppShell'
import { EnvironmentProvider } from './providers/EnvironmentProvider'
import { defaultRouteId, isKnownRoute } from './routes'

/** Sign-in gate: the shell and its navigation only exist once authenticated. */
function AuthenticatedApp() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) return <LoginPage />

  return (
    <NavigationProvider fallback={defaultRouteId} isKnown={isKnownRoute}>
      <EnvironmentProvider>
        <AppShell />
      </EnvironmentProvider>
    </NavigationProvider>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}
