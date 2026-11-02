import type { Credentials, User } from '../model'
import { demoCredentials, demoUser } from '../data/users.fixture'

/**
 * Authentication boundary. The prototype accepts any non-empty credentials and
 * returns the demo identity; replacing this module with a call to the identity
 * provider is the only change needed to make sign-in real.
 */
export const authRepository = {
  getPrefilledCredentials(): Credentials {
    return { ...demoCredentials }
  },

  signIn(credentials: Credentials): User | null {
    if (!credentials.email.trim() || !credentials.password.trim()) return null
    return demoUser
  },

  /** Single sign-on shortcut; no credentials are collected in the prototype. */
  signInWithSso(): User {
    return demoUser
  },
}
