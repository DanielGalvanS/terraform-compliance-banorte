import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requiere, respuestasAuth } from '../auth/autorizacion.ts'
import { Ambiente } from '../model/esquemas.ts'
import {
  estadoDeRecurso,
  etiquetasFaltantes,
  Recurso,
  ResumenInventario,
  type RecursoGuardado,
} from '../model/recursos.ts'
import type { Catalogo } from '../repositorios/catalogoRepositorio.ts'
import type { ExcepcionesRepositorio } from '../repositorios/excepcionesRepositorio.ts'
import type { HallazgosRepositorio } from '../repositorios/hallazgosRepositorio.ts'
import { listarHallazgos } from './hallazgosVigentes.ts'

export function rutasRecursos(
  catalogo: Catalogo,
  recursos: RecursoGuardado[],
  hallazgos: HallazgosRepositorio,
  excepciones: ExcepcionesRepositorio,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/recursos',
      {
        onRequest: requiere('leer'),
        schema: {
          summary: 'Inventario de recursos gestionados',
          description:
            'El estado de cada recurso se calcula a partir de sus etiquetas y de los ' +
            'hallazgos abiertos sobre él; no es un campo guardado que alguien deba ' +
            'mantener al día.',
          tags: ['inventario'],
          querystring: z.object({
            modulo: z.string().optional(),
            ambiente: Ambiente.optional(),
            buscar: z.string().optional(),
          }),
          response: {
            ...respuestasAuth,
            200: z.object({
              recursos: z.array(Recurso),
              resumen: ResumenInventario,
              etiquetasObligatorias: z.array(z.string()),
            }),
          },
        },
      },
      async (peticion) => {
        const todos = await listarHallazgos(hallazgos, excepciones)
        const porRecurso = new Map<string, { estado: string }[]>()
        for (const hallazgo of todos) {
          const lista = porRecurso.get(hallazgo.recurso) ?? []
          lista.push({ estado: hallazgo.estado })
          porRecurso.set(hallazgo.recurso, lista)
        }

        const completos = recursos.map((recurso) => {
          const faltantes = etiquetasFaltantes(
            recurso.etiquetas,
            catalogo.etiquetasObligatorias,
            recurso.tipo,
            catalogo.tiposEtiquetables,
          )
          return {
            ...recurso,
            etiquetasFaltantes: faltantes,
            estado: estadoDeRecurso(faltantes, porRecurso.get(recurso.direccion) ?? []),
          }
        })

        const { modulo, ambiente, buscar } = peticion.query
        const aguja = buscar?.trim().toLowerCase() ?? ''
        const visibles = completos.filter(
          (recurso) =>
            (modulo === undefined || recurso.modulo === modulo) &&
            (ambiente === undefined || recurso.ambiente === ambiente) &&
            (aguja === '' || recurso.nombre.toLowerCase().includes(aguja)),
        )

        // El resumen describe el inventario completo, no el filtrado: una
        // búsqueda no debería cambiar la cobertura de etiquetas del ambiente.
        //
        // La cobertura se mide sobre los recursos etiquetables. Incluir los que
        // no admiten etiquetas hundiría el porcentaje sin que hubiera nada que
        // corregir.
        const etiquetables = completos.filter((r) => catalogo.tiposEtiquetables.includes(r.tipo))
        const completas = etiquetables.filter((r) => r.etiquetasFaltantes.length === 0).length
        return {
          recursos: visibles,
          etiquetasObligatorias: catalogo.etiquetasObligatorias,
          resumen: {
            total: completos.length,
            modulos: new Set(completos.map((r) => r.modulo)).size,
            conEtiquetasCompletas: completas,
            etiquetables: etiquetables.length,
            coberturaEtiquetas:
              etiquetables.length === 0
                ? 100
                : Math.round((completas / etiquetables.length) * 1000) / 10,
            noConformes: completos.filter((r) => r.estado === 'No conforme').length,
          },
        }
      },
    )
  }
}
