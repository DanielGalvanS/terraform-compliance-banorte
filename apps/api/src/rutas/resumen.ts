import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { Resumen } from '../model/esquemas.ts'
import type { Catalogo } from '../repositorios/catalogoRepositorio.ts'
import type { HallazgosRepositorio } from '../repositorios/hallazgosRepositorio.ts'

/** Cifras de portada: lo que alimenta la pantalla de visión general. */
export function rutasResumen(
  catalogo: Catalogo,
  repositorio: HallazgosRepositorio,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/resumen',
      {
        schema: {
          summary: 'Postura de cumplimiento en cifras',
          tags: ['resumen'],
          response: { 200: Resumen },
        },
      },
      async () => {
        const abiertos = await repositorio.listar({ estado: 'Abierto' })
        const todos = await repositorio.listar({})

        const porSeveridad = { Crítica: 0, Alta: 0, Media: 0, Baja: 0 }
        for (const hallazgo of todos) porSeveridad[hallazgo.severidad] += 1

        return {
          hallazgosAbiertos: abiertos.length,
          porSeveridad,
          controles: catalogo.controles.length,
          marcos: catalogo.marcos.length,
        }
      },
    )
  }
}
