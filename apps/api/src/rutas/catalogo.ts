import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { Control, Marco } from '../model/esquemas.ts'
import type { Catalogo } from '../repositorios/catalogoRepositorio.ts'

/** Marcos y controles, tal como los declara el catálogo de políticas. */
export function rutasCatalogo(catalogo: Catalogo): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/marcos',
      {
        schema: {
          summary: 'Marcos regulatorios en alcance',
          tags: ['catálogo'],
          response: {
            200: z.object({ version: z.string(), marcos: z.array(Marco) }),
          },
        },
      },
      async () => ({ version: catalogo.version, marcos: catalogo.marcos }),
    )

    app.get(
      '/controles',
      {
        schema: {
          summary: 'Controles codificados y su mapeo a marcos',
          tags: ['catálogo'],
          querystring: z.object({
            marco: z.string().optional().describe('Filtra por nombre corto del marco'),
          }),
          response: {
            200: z.object({ version: z.string(), controles: z.array(Control) }),
          },
        },
      },
      async (peticion) => {
        const { marco } = peticion.query
        const controles =
          marco === undefined
            ? catalogo.controles
            : catalogo.controles.filter((c) => c.mapeo.some((m) => m.marco === marco))
        return { version: catalogo.version, controles }
      },
    )
  }
}
