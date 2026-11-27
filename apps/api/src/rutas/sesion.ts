import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { emitirTokenLocal } from '../auth/verificador.ts'
import { Accion, Error as ErrorRespuesta, Rol } from '../model/esquemas.ts'
import { PERMISOS } from '../model/permisos.ts'
import { CONTRASENA_DEMO, usuariosDemo } from '../repositorios/usuariosDemo.ts'

const DURACION_SESION = '8h'

/**
 * Inicio de sesión con los usuarios de demostración. Solo se registra en modo
 * local: con un proveedor de identidad real, el login es suyo y esta ruta no
 * existe (404).
 */
export function rutasSesion(secreto: string): FastifyPluginAsyncZod {
  return async (app) => {
    app.post(
      '/sesion',
      {
        schema: {
          summary: 'Inicia sesión con un usuario de demostración',
          description:
            'Solo en modo local (AUTH_MODO=local). Los usuarios de demostración tienen ' +
            'una contraseña pública: sirven para elegir con qué rol probar, no para ' +
            'proteger nada. Devuelve los permisos del rol para que la pantalla oculte ' +
            'lo que no se puede hacer, sin copiar la tabla de la API.',
          tags: ['sesión'],
          security: [],
          body: z.object({ email: z.string(), password: z.string() }),
          response: {
            200: z.object({
              token: z.string(),
              usuario: z.object({
                nombre: z.string(),
                email: z.string(),
                rol: Rol,
                iniciales: z.string(),
              }),
              permisos: z.array(Accion),
            }),
            401: ErrorRespuesta,
          },
        },
      },
      async (peticion, respuesta) => {
        const email = peticion.body.email.trim().toLowerCase()
        const usuario = usuariosDemo.find((u) => u.email === email)
        // Un solo mensaje para usuario y contraseña: decir cuál falló le
        // confirmaría a un atacante qué correos existen.
        if (usuario === undefined || peticion.body.password !== CONTRASENA_DEMO) {
          return respuesta.code(401).send({ error: 'Correo o contraseña incorrectos' })
        }
        const { sujeto, nombre, rol } = usuario
        return {
          token: await emitirTokenLocal(
            secreto,
            { sujeto, nombre, rol, email: usuario.email },
            DURACION_SESION,
          ),
          usuario: { nombre, email: usuario.email, rol, iniciales: usuario.iniciales },
          permisos: [...PERMISOS[rol]],
        }
      },
    )
  }
}
