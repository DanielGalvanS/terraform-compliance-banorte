import { clienteApi, ErrorApi, establecerToken, hayApi } from '@/shared/api'
import type { Credentials, User } from '../model'
import { demoAccounts, demoCredentials, demoUser } from '../data/users.fixture'

/**
 * Authentication boundary.
 *
 * Con API, el acceso lo valida `POST /sesion` y el token queda en el cliente
 * HTTP para las siguientes peticiones. Sin API, el prototipo acepta cualquier
 * par no vacío y devuelve la identidad de demostración, como antes.
 */
export const authRepository = {
  getPrefilledCredentials(): Credentials {
    return { ...demoCredentials }
  },

  demoAccounts,

  /** Null cuando las credenciales no son válidas, para que el formulario lo diga. */
  async signIn(credentials: Credentials): Promise<User | null> {
    if (!credentials.email.trim() || !credentials.password.trim()) return null
    if (!hayApi) return demoUser

    try {
      const sesion = await clienteApi.iniciarSesion(credentials)
      establecerToken(sesion.token)
      return {
        name: sesion.usuario.nombre,
        email: sesion.usuario.email,
        role: sesion.usuario.rol,
        initials: sesion.usuario.iniciales,
        permissions: sesion.permisos,
      }
    } catch (causa) {
      if (causa instanceof ErrorApi && causa.estado === 401) return null
      throw causa
    }
  },

  /**
   * Single sign-on shortcut. Solo existe en el prototipo sin API: con API, el
   * SSO lo dará el proveedor de identidad y no hay a dónde redirigir todavía.
   */
  signInWithSso(): User | null {
    return hayApi ? null : demoUser
  },

  signOut() {
    establecerToken(null)
  },
}
