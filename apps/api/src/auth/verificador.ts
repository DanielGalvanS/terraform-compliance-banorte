import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from 'jose'
import { Identidad } from '../model/esquemas.ts'

/**
 * Convierte un token en una identidad, o en null si no es válido.
 *
 * Es una interfaz para que las rutas no sepan de dónde salen los tokens: hoy
 * los firma la propia API (modo local) y con GCP los emitirá el proveedor de
 * identidad (modo jwks). Cambiar de uno a otro no toca ninguna ruta.
 */
export type Verificador = {
  verificar(token: string): Promise<Identidad | null>
}

export const EMISOR_LOCAL = 'compliance-ops-local'
export const AUDIENCIA_API = 'compliance-ops-api'

/** Lee la identidad de los claims. Un token sin rol válido no autoriza nada. */
function identidadDe(claims: JWTPayload): Identidad | null {
  const resultado = Identidad.safeParse({
    sujeto: claims.sub,
    nombre: claims['name'],
    rol: claims['rol'],
  })
  return resultado.success ? resultado.data : null
}

/** Tokens HS256 firmados por esta misma API. Solo para desarrollo y pruebas. */
export function verificadorLocal(secreto: string): Verificador {
  const llave = new TextEncoder().encode(secreto)
  return {
    async verificar(token) {
      try {
        const { payload } = await jwtVerify(token, llave, {
          algorithms: ['HS256'],
          issuer: EMISOR_LOCAL,
          audience: AUDIENCIA_API,
        })
        return identidadDe(payload)
      } catch {
        return null
      }
    },
  }
}

/** Firma un token local. Lo usan /sesion, `npm run token` y las pruebas. */
export async function emitirTokenLocal(
  secreto: string,
  identidad: Identidad,
  duracion: string = '8h',
): Promise<string> {
  return new SignJWT({ name: identidad.nombre, rol: identidad.rol })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(identidad.sujeto)
    .setIssuer(EMISOR_LOCAL)
    .setAudience(AUDIENCIA_API)
    .setIssuedAt()
    .setExpirationTime(duracion)
    .sign(new TextEncoder().encode(secreto))
}

/**
 * Tokens del proveedor de identidad, verificados con sus llaves públicas.
 *
 * El rol sale del claim `rol`. El proveedor es quien lo asigna; si el token no
 * lo trae, la petición no tiene permisos, en vez de suponer uno por defecto.
 * Solo se aceptan algoritmos asimétricos: con HS256 cualquiera que conociera
 * un secreto compartido podría firmar.
 */
export function verificadorJwks(opciones: {
  url: string
  emisor: string
  audiencia: string
}): Verificador {
  const llaves = createRemoteJWKSet(new URL(opciones.url))
  return {
    async verificar(token) {
      try {
        const { payload } = await jwtVerify(token, llaves, {
          algorithms: ['RS256', 'ES256'],
          issuer: opciones.emisor,
          audience: opciones.audiencia,
        })
        return identidadDe(payload)
      } catch {
        return null
      }
    },
  }
}
