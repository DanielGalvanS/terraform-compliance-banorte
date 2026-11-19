import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { EventoEvidencia, TipoEvento } from '../model/esquemas.ts'
import type { EvidenciaRepositorio } from '../repositorios/evidenciaRepositorio.ts'

export function rutasEvidencia(evidencia: EvidenciaRepositorio): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/evidencia',
      {
        schema: {
          summary: 'Registro de evidencia',
          description:
            'Decisiones sobre excepciones y cambios de estado de hallazgos, del más reciente ' +
            'al más antiguo. Cada evento guarda el hash del anterior; `integra` dice si la ' +
            'cadena completa sigue coincidiendo, no solo los eventos filtrados.',
          tags: ['evidencia'],
          querystring: z.object({
            tipo: TipoEvento.optional(),
            objetoId: z.string().optional(),
          }),
          response: {
            200: z.object({
              eventos: z.array(EventoEvidencia),
              integra: z.boolean().describe('Si ningún evento del registro fue alterado'),
            }),
          },
        },
      },
      async (peticion) => {
        // Se verifica la cadena entera aunque se pida un filtro: un evento
        // filtrado puede estar bien y depender de uno anterior alterado.
        const [eventos, { integra }] = await Promise.all([
          evidencia.listar(peticion.query),
          evidencia.verificar(),
        ])
        return { eventos, integra }
      },
    )
  }
}
