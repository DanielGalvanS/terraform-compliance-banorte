import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { actor, requiere, respuestasAuth } from '../auth/autorizacion.ts'
import { Accion, Rol } from '../model/esquemas.ts'
import { PERMISOS } from '../model/permisos.ts'

/**
 * Quién es el usuario del token y qué puede hacer.
 *
 * Con Identity Platform, el inicio de sesión no pasa por la API (no hay
 * /sesion): la pantalla obtiene el token del proveedor y le pregunta aquí sus
 * permisos, para ocultar lo que no puede hacer sin copiar la tabla. Funciona
 * igual en modo local.
 */
export function rutasIdentidad(): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/yo',
      {
        onRequest: requiere('leer'),
        schema: {
          summary: 'El usuario del token y sus permisos',
          tags: ['sesión'],
          response: {
            ...respuestasAuth,
            200: z.object({
              usuario: z.object({
                nombre: z.string(),
                email: z.string().optional(),
                rol: Rol,
              }),
              permisos: z.array(Accion),
            }),
          },
        },
      },
      async (peticion) => {
        const { nombre, email, rol } = actor(peticion)
        return {
          usuario: { nombre, rol, ...(email === undefined ? {} : { email }) },
          permisos: [...PERMISOS[rol]],
        }
      },
    )
  }
}
