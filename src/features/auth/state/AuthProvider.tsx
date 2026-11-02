import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { authRepository } from '../api/authRepository'
import type { Credentials, User } from '../model'

type AuthContextValue = {
  user: User | null
  isAuthenticated: boolean
  /** Returns false when the credentials are rejected, so the form can explain. */
  signIn: (credentials: Credentials) => boolean
  signInWithSso: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn: (credentials) => {
        const authenticated = authRepository.signIn(credentials)
        setUser(authenticated)
        return authenticated !== null
      },
      signInWithSso: () => setUser(authRepository.signInWithSso()),
      signOut: () => setUser(null),
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
