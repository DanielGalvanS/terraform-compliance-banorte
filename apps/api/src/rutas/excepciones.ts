import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  Error as ErrorRespuesta,
  Excepcion,
  FiltroExcepciones,
  NuevaExcepcion,
} from '../model/esquemas.ts'
import { estadoVigente, validarSolicitud } from '../model/reglasExcepciones.ts'
import type { Catalogo } from '../repositorios/catalogoRepositorio.ts'
import type {
  ExcepcionesRepositorio,
  ExcepcionGuardada,
} from '../repositorios/excepcionesRepositorio.ts'

/** Error con el detalle de cada campo rechazado, no solo un mensaje suelto. */
const ErrorValidacion = ErrorRespuesta.extend({
  motivos: z.array(z.object({ campo: z.string(), mensaje: z.string() })),
})

export function rutasExcepciones(
  catalogo: Catalogo,
  repositorio: ExcepcionesRepositorio,
): FastifyPluginAsyncZod {
  /**
   * Completa la excepción con los datos del control y su estado vigente.
   * El nombre, el marco y la severidad no se guardan: se toman del catálogo
   * al leer, para que una excepción no congele una descripción obsoleta.
   */
  const completar = (guardada: ExcepcionGuardada): z.infer<typeof Excepcion> => {
    const control = catalogo.controles.find((c) => c.codigo === guardada.control)
    const { estadoGuardado, ...resto } = guardada
    return {
      ...resto,
      controlNombre: control?.titulo ?? 'Control desconocido',
      marco: control?.mapeo[0]?.marco ?? '—',
      severidad: control?.severidad ?? 'Media',
      estado: estadoVigente(estadoGuardado, guardada.venceEl),
    }
  }

  return async (app) => {
    app.get(
      '/excepciones',
      {
        schema: {
          summary: 'Excepciones registradas',
          description:
            'El estado se deriva de la fecha: una excepción activa cuya vigencia pasó ' +
            'se devuelve como Vencida aunque nadie haya corrido un proceso que la marque.',
          tags: ['excepciones'],
          querystring: FiltroExcepciones,
          response: { 200: z.object({ excepciones: z.array(Excepcion) }) },
        },
      },
      async (peticion) => ({
        excepciones: (await repositorio.listar(peticion.query)).map(completar),
      }),
    )

    app.post(
      '/excepciones',
      {
        schema: {
          summary: 'Solicita una excepción',
          description:
            'Siempre nace Pendiente: nada se exceptúa sin aprobación humana. La ' +
            'severidad la decide el control, no quien la solicita.',
          tags: ['excepciones'],
          body: NuevaExcepcion,
          response: { 201: Excepcion, 422: ErrorValidacion },
        },
      },
      async (peticion, respuesta) => {
        const motivos = validarSolicitud(
          peticion.body,
          new Set(catalogo.controles.map((c) => c.codigo)),
        )
        if (motivos.length > 0) {
          return respuesta.code(422).send({
            error: 'La solicitud no cumple las reglas de excepción',
            motivos,
          })
        }

        const guardada = await repositorio.crear({
          control: peticion.body.control,
          recurso: peticion.body.recurso,
          ambiente: peticion.body.ambiente,
          justificacion: peticion.body.justificacion.trim(),
          solicitadaPor: 'Ana Martínez',
          // Se registra a quién se le pide, no quién aprobó: aún nadie lo hizo.
          aprobadaPor: null,
          solicitadaEn: new Date().toISOString(),
          venceEl: peticion.body.venceEl,
          planRemediacion: peticion.body.planRemediacion?.trim() || null,
        })
        return respuesta.code(201).send(completar(guardada))
      },
    )
  }
}
