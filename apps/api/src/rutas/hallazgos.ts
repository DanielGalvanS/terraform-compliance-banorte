import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { actor, requiere, respuestasAuth } from '../auth/autorizacion.ts'
import {
  CambioEstadoHallazgo,
  Error as ErrorRespuesta,
  FiltroHallazgos,
  Hallazgo,
  NuevoHallazgo,
} from '../model/esquemas.ts'
import { TRANSICIONES, validarCambioEstado } from '../model/reglasHallazgos.ts'
import type { EvidenciaRepositorio } from '../repositorios/evidenciaRepositorio.ts'
import type { ExcepcionesRepositorio } from '../repositorios/excepcionesRepositorio.ts'
import type { HallazgosRepositorio } from '../repositorios/hallazgosRepositorio.ts'
import {
  completarHallazgo,
  excepcionesActivas,
  listarHallazgos,
  obtenerHallazgo,
} from './hallazgosVigentes.ts'

/** Error con el detalle de cada campo rechazado, no solo un mensaje suelto. */
const ErrorValidacion = ErrorRespuesta.extend({
  motivos: z.array(z.object({ campo: z.string(), mensaje: z.string() })),
})

const transicionesLegibles = Object.entries(TRANSICIONES)
  .map(([de, a]) => `${de} → ${a.length > 0 ? a.join(', ') : 'ninguno'}`)
  .join('; ')

export function rutasHallazgos(
  repositorio: HallazgosRepositorio,
  excepciones: ExcepcionesRepositorio,
  evidencia: EvidenciaRepositorio,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/hallazgos',
      {
        onRequest: requiere('leer'),
        schema: {
          summary: 'Hallazgos, con filtros opcionales',
          description:
            'El estado se deriva: un hallazgo abierto o en remediación que cubre una ' +
            'excepción activa y vigente se muestra como Excepción, y vuelve solo a su ' +
            'estado cuando la excepción vence o se revoca. El filtro ?estado= usa ese ' +
            'estado mostrado.',
          tags: ['hallazgos'],
          querystring: FiltroHallazgos,
          response: { ...respuestasAuth, 200: z.object({ hallazgos: z.array(Hallazgo) }) },
        },
      },
      async (peticion) => ({
        hallazgos: await listarHallazgos(repositorio, excepciones, peticion.query),
      }),
    )

    app.get(
      '/hallazgos/:id',
      {
        onRequest: requiere('leer'),
        schema: {
          summary: 'Un hallazgo por identificador',
          tags: ['hallazgos'],
          params: z.object({ id: z.uuid() }),
          response: { ...respuestasAuth, 200: Hallazgo, 404: ErrorRespuesta },
        },
      },
      async (peticion, respuesta) => {
        const hallazgo = await obtenerHallazgo(repositorio, excepciones, peticion.params.id)
        if (hallazgo === null) {
          return respuesta.code(404).send({ error: 'No existe ese hallazgo' })
        }
        return hallazgo
      },
    )

    app.post(
      '/hallazgos',
      {
        onRequest: requiere('registrarHallazgo'),
        schema: {
          summary: 'Registra un hallazgo detectado por el pipeline',
          description:
            'Acepta la cabecera Idempotency-Key. Con la misma clave, un reintento ' +
            'devuelve el hallazgo ya registrado y responde 200 en vez de 201.',
          tags: ['hallazgos'],
          headers: z.object({
            'idempotency-key': z.string().min(8).optional(),
          }),
          body: NuevoHallazgo,
          response: { ...respuestasAuth, 200: Hallazgo, 201: Hallazgo },
        },
      },
      async (peticion, respuesta) => {
        const clave = peticion.headers['idempotency-key']
        const { hallazgo, yaExistia } = await repositorio.crear(peticion.body, clave)
        // Un hallazgo nuevo puede nacer cubierto por una excepción ya aprobada.
        const completo = completarHallazgo(hallazgo, await excepcionesActivas(excepciones))
        // 200 y no 201: con un reintento no se creó nada nuevo.
        return respuesta.code(yaExistia ? 200 : 201).send(completo)
      },
    )

    // PATCH y no POST: cambia un campo del hallazgo. A diferencia de aprobar
    // una excepción, no crea nada; las reglas acotan a qué valor puede pasar.
    app.patch(
      '/hallazgos/:id/estado',
      {
        onRequest: requiere('cambiarEstadoHallazgo'),
        schema: {
          summary: 'Cambia el estado de un hallazgo',
          description:
            `Solo se permiten estas transiciones: ${transicionesLegibles}. Otra responde ` +
            '409. A Excepción no se llega por aquí sino aprobando una excepción (422), para ' +
            'no saltarse la aprobación humana. Uno cubierto por una excepción vigente ' +
            'tampoco cambia por aquí (409): hay que revocarla o esperar a que venza. El ' +
            'comentario es obligatorio (422) y el cambio queda en el registro de evidencia.',
          tags: ['hallazgos'],
          params: z.object({ id: z.uuid() }),
          body: CambioEstadoHallazgo,
          response: {
            ...respuestasAuth,
            200: Hallazgo,
            404: ErrorRespuesta,
            409: ErrorRespuesta,
            422: ErrorValidacion,
          },
        },
      },
      async (peticion, respuesta) => {
        const { estado, comentario } = peticion.body
        const quien = actor(peticion)
        const hallazgo = await obtenerHallazgo(repositorio, excepciones, peticion.params.id)
        if (hallazgo === null) {
          return respuesta.code(404).send({ error: 'No existe ese hallazgo' })
        }

        // Mientras la excepción lo cubre, cerrarlo o reabrirlo a mano dejaría
        // el registro diciendo dos cosas a la vez. El camino es revocarla.
        if (hallazgo.excepcion !== null) {
          return respuesta.code(409).send({
            error:
              `Está cubierto por la excepción ${hallazgo.excepcion.codigo} hasta ` +
              `${hallazgo.excepcion.venceEl}; revócala o espera a que venza.`,
          })
        }

        const { conflicto, motivos } = validarCambioEstado(hallazgo.estado, estado, comentario)
        // El conflicto va primero, como al decidir una excepción: si el estado
        // actual no lo permite, corregir los datos no cambiaría la respuesta.
        // Pedir Excepción nunca da conflicto, así que siempre llega al 422.
        if (conflicto !== null) {
          return respuesta.code(409).send({ error: conflicto })
        }
        if (motivos.length > 0) {
          return respuesta.code(422).send({
            error: 'El cambio no cumple las reglas de estado',
            motivos,
          })
        }

        const cambiado = await repositorio.cambiarEstado(hallazgo.id, estado)
        if (cambiado === null) {
          return respuesta.code(404).send({ error: 'No existe ese hallazgo' })
        }
        await evidencia.registrar({
          tipo: 'hallazgo.estado',
          objetoId: cambiado.id,
          actor: quien.nombre,
          detalle: {
            de: hallazgo.estado,
            a: cambiado.estado,
            comentario: comentario.trim(),
            sujeto: quien.sujeto,
          },
        })
        return completarHallazgo(cambiado, await excepcionesActivas(excepciones))
      },
    )
  }
}
