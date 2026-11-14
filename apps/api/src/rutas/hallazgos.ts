import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  Error as ErrorRespuesta,
  FiltroHallazgos,
  Hallazgo,
  NuevoHallazgo,
} from '../model/esquemas.ts'
import type { HallazgosRepositorio } from '../repositorios/hallazgosRepositorio.ts'

export function rutasHallazgos(repositorio: HallazgosRepositorio): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/hallazgos',
      {
        schema: {
          summary: 'Hallazgos, con filtros opcionales',
          tags: ['hallazgos'],
          querystring: FiltroHallazgos,
          response: { 200: z.object({ hallazgos: z.array(Hallazgo) }) },
        },
      },
      async (peticion) => ({ hallazgos: await repositorio.listar(peticion.query) }),
    )

    app.get(
      '/hallazgos/:id',
      {
        schema: {
          summary: 'Un hallazgo por identificador',
          tags: ['hallazgos'],
          params: z.object({ id: z.uuid() }),
          response: { 200: Hallazgo, 404: ErrorRespuesta },
        },
      },
      async (peticion, respuesta) => {
        const hallazgo = await repositorio.obtener(peticion.params.id)
        if (hallazgo === null) {
          return respuesta.code(404).send({ error: 'No existe ese hallazgo' })
        }
        return hallazgo
      },
    )

    app.post(
      '/hallazgos',
      {
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
          response: { 200: Hallazgo, 201: Hallazgo },
        },
      },
      async (peticion, respuesta) => {
        const clave = peticion.headers['idempotency-key']
        const { hallazgo, yaExistia } = await repositorio.crear(peticion.body, clave)
        // 200 y no 201: con un reintento no se creó nada nuevo.
        return respuesta.code(yaExistia ? 200 : 201).send(hallazgo)
      },
    )
  }
}
