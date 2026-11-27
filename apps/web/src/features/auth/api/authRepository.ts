import { clienteApi, ErrorApi, establecerToken, hayApi } from '@/shared/api'
import type { Credentials, User } from '../model'
import { demoAccounts, demoCredentials, demoUser } from '../data/users.fixture'
import { ErrorIdentidad, hayIdentityPlatform, iniciarSesionIdp } from './identityPlatform'

/** El modo de acceso, que se decide al compilar con las variables VITE_*. */
export type ModoAcceso = 'identity-platform' | 'demo-api' | 'prototipo'

export const modoAcceso: ModoAcceso = !hayApi
  ? 'prototipo'
  : hayIdentityPlatform
    ? 'identity-platform'
    : 'demo-api'

/** Un usuario existe en Identity Platform pero no tiene rol: la API no le da permisos. */
export class SinRol extends Error {
  constructor() {
    super('Tu usuario no tiene un rol asignado. Pide a Cumplimiento que te lo asigne.')
    this.name = 'SinRol'
  }
}

/** Iniciales para el avatar, a partir del nombre que da el proveedor. */
function iniciales(nombre: string): string {
  const partes = nombre.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return partes
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/**
 * Authentication boundary.
 *
 * - Identity Platform: el proveedor valida correo y contraseña y entrega un
 *   token; la API dice en `/yo` quién es y qué puede hacer.
 * - Demo con API: `POST /sesion` con los usuarios de demostración.
 * - Sin API: el prototipo acepta cualquier par no vacío, como antes.
 */
export const authRepository = {
  modo: modoAcceso,

  /** Con el acceso real no se precarga nada: cada quien escribe lo suyo. */
  getPrefilledCredentials(): Credentials {
    return modoAcceso === 'identity-platform' ? { email: '', password: '' } : { ...demoCredentials }
  },

  demoAccounts,

  /** Null cuando las credenciales no son válidas, para que el formulario lo diga. */
  async signIn(credentials: Credentials): Promise<User | null> {
    if (!credentials.email.trim() || !credentials.password.trim()) return null
    if (modoAcceso === 'prototipo') return demoUser
    if (modoAcceso === 'identity-platform') return entrarConIdp(credentials)

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

async function entrarConIdp(credentials: Credentials): Promise<User | null> {
  const token = await iniciarSesionIdp(credentials)
  if (token === null) return null

  establecerToken(token)
  try {
    const { usuario, permisos } = await clienteApi.yo()
    return {
      name: usuario.nombre,
      email: usuario.email ?? credentials.email.trim(),
      role: usuario.rol,
      initials: iniciales(usuario.nombre),
      permissions: permisos,
    }
  } catch (causa) {
    establecerToken(null)
    // El proveedor aceptó la contraseña pero la API no: el token no trae un
    // rol válido.
    if (causa instanceof ErrorApi && causa.estado === 401) throw new SinRol()
    throw causa
  }
}

export { ErrorIdentidad }
