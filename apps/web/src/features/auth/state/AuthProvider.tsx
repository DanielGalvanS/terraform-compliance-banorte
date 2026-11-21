import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { alSesionExpirada } from '@/shared/api'
import { authRepository } from '../api/authRepository'
import type { Credentials, User } from '../model'

type AuthContextValue = {
  user: User | null
  isAuthenticated: boolean
  /** Resolves false when the credentials are rejected, so the form can explain. */
  signIn: (credentials: Credentials) => Promise<boolean>
  signInWithSso: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  // Si la API responde 401 (token vencido), se vuelve a la pantalla de acceso
  // en lugar de dejar pantallas vacías con errores sueltos.
  useEffect(() => {
    alSesionExpirada(() => setUser(null))
    return () => alSesionExpirada(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn: async (credentials) => {
        const authenticated = await authRepository.signIn(credentials)
        setUser(authenticated)
        return authenticated !== null
      },
      signInWithSso: () => setUser(authRepository.signInWithSso()),
      signOut: () => {
        authRepository.signOut()
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
