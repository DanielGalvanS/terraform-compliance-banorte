import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { Error as ErrorRespuesta, type Identidad } from '../model/esquemas.ts'
import { puede, type Accion } from '../model/permisos.ts'
import type { Verificador } from './verificador.ts'

declare module 'fastify' {
  interface FastifyRequest {
    /** Null si la petición no trae un token válido. */
    identidad: Identidad | null
  }
}

/** Respuestas que toda ruta protegida puede dar, para que salgan en el OpenAPI. */
export const respuestasAuth = { 401: ErrorRespuesta, 403: ErrorRespuesta } as const

/**
 * Lee el token de cada petición y deja la identidad en `peticion.identidad`.
 *
 * No rechaza nada: las rutas públicas (salud, documentación, sesión) deben
 * funcionar aunque llegue un token vencido. Quien exige identidad es
 * `requiere`, ruta por ruta.
 */
export function registrarAutenticacion(app: FastifyInstance, verificador: Verificador) {
  app.decorateRequest('identidad', null)
  app.addHook('onRequest', async (peticion) => {
    const cabecera = peticion.headers.authorization
    if (cabecera === undefined || !cabecera.startsWith('Bearer ')) return
    peticion.identidad = await verificador.verificar(cabecera.slice('Bearer '.length).trim())
  })
}

/**
 * Exige que quien llama tenga permiso para la acción: 401 si no se sabe quién
 * es, 403 si se sabe y su rol no alcanza. La diferencia importa al cliente:
 * con 401 hay que volver a iniciar sesión; con 403, no serviría de nada.
 */
export function requiere(accion: Accion) {
  return async (peticion: FastifyRequest, respuesta: FastifyReply) => {
    if (peticion.identidad === null) {
      return respuesta.code(401).send({ error: 'Falta un token válido' })
    }
    if (!puede(peticion.identidad.rol, accion)) {
      return respuesta.code(403).send({
        error: `El rol ${peticion.identidad.rol} no puede ${accion}`,
      })
    }
  }
}

/**
 * La identidad de una ruta protegida. Solo se llama después de `requiere`,
 * que ya garantizó que existe; si faltara, es un error de programación y no
 * debe convertirse en una petición anónima.
 */
export function actor(peticion: FastifyRequest): Identidad {
  if (peticion.identidad === null) throw new Error('Ruta protegida sin requiere()')
  return peticion.identidad
}
