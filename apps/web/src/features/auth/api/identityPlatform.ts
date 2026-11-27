import type { Credentials } from '../model'

/**
 * Llave de API del navegador para Identity Platform. No es un secreto: va
 * escrita en el JavaScript y está restringida a iniciar sesión desde la URL
 * del frontend (scripts/identidad/crear_usuarios.sh). Con ella, el acceso es
 * el real; sin ella, el de demostración.
 */
const LLAVE: string | undefined = import.meta.env['VITE_IDP_API_KEY']

export const hayIdentityPlatform = LLAVE !== undefined && LLAVE !== ''

const URL_INICIO =
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'

/** Lo que Identity Platform responde cuando las credenciales no sirven. */
const CREDENCIALES_RECHAZADAS = new Set([
  'INVALID_LOGIN_CREDENTIALS',
  'EMAIL_NOT_FOUND',
  'INVALID_PASSWORD',
  'INVALID_EMAIL',
  'USER_DISABLED',
])

export class ErrorIdentidad extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorIdentidad'
  }
}

/**
 * Inicia sesión con correo y contraseña y devuelve el ID token, o null si las
 * credenciales no son válidas.
 *
 * Se usa la API REST y no el SDK de Firebase: es una sola llamada, y así no se
 * agrega una dependencia grande para eso. El token dura una hora; al vencer,
 * la API responde 401 y la pantalla vuelve al acceso.
 */
export async function iniciarSesionIdp(credenciales: Credentials): Promise<string | null> {
  if (!hayIdentityPlatform) throw new ErrorIdentidad('Identity Platform no está configurado')

  let respuesta: Response
  try {
    respuesta = await fetch(`${URL_INICIO}?key=${encodeURIComponent(LLAVE!)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: credenciales.email.trim(),
        password: credenciales.password,
        returnSecureToken: true,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ErrorIdentidad('No se pudo contactar con el servicio de identidad')
  }

  if (respuesta.ok) {
    const cuerpo = (await respuesta.json()) as { idToken: string }
    return cuerpo.idToken
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as {
    error?: { message?: string }
  } | null
  // El mensaje puede traer detalle tras « : », por ejemplo
  // «TOO_MANY_ATTEMPTS_TRY_LATER : …». Solo importa el código.
  const codigo = cuerpo?.error?.message?.split(' ')[0] ?? ''
  if (CREDENCIALES_RECHAZADAS.has(codigo)) return null
  if (codigo.startsWith('TOO_MANY_ATTEMPTS')) {
    throw new ErrorIdentidad('Demasiados intentos. Espera unos minutos antes de volver a intentar.')
  }
  throw new ErrorIdentidad('El servicio de identidad no respondió como se esperaba')
}
