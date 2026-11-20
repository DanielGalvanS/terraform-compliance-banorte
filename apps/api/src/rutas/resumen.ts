import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requiere, respuestasAuth } from '../auth/autorizacion.ts'
import type { CoberturaMarco, Hallazgo } from '../model/esquemas.ts'
import { Resumen } from '../model/esquemas.ts'
import type { Catalogo } from '../repositorios/catalogoRepositorio.ts'
import type { HallazgosRepositorio } from '../repositorios/hallazgosRepositorio.ts'

/**
 * Cobertura por marco, calculada a partir del catálogo y de los hallazgos.
 *
 * Un control cuenta como conforme cuando no tiene ningún hallazgo abierto.
 * El porcentaje sale de ahí, de modo que la cifra se puede explicar y
 * reproducir: ningún número del tablero es una constante escrita a mano.
 *
 * Un marco sin controles mapeados da 100%, no una división por cero: no hay
 * nada que incumplir.
 */
export function calcularCobertura(
  catalogo: Catalogo,
  hallazgos: Hallazgo[],
): CoberturaMarco[] {
  const abiertos = hallazgos.filter((h) => h.estado === 'Abierto' || h.estado === 'En remediación')
  const controlesConHallazgo = new Set(
    abiertos.map((h) => h.control).filter((control): control is string => control !== null),
  )

  return catalogo.marcos.map((marco) => {
    const controles = catalogo.controles.filter((control) =>
      control.mapeo.some((referencia) => referencia.marco === marco.nombreCorto),
    )
    const conformes = controles.filter((control) => !controlesConHallazgo.has(control.codigo))
    return {
      marco: marco.nombreCorto,
      controles: controles.length,
      conformes: conformes.length,
      porcentaje:
        controles.length === 0
          ? 100
          : Math.round((conformes.length / controles.length) * 1000) / 10,
    }
  })
}

export function rutasResumen(
  catalogo: Catalogo,
  repositorio: HallazgosRepositorio,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/resumen',
      {
        preHandler: requiere('leer'),
        schema: {
          summary: 'Postura de cumplimiento en cifras',
          description:
            'La cobertura por marco se calcula: un control es conforme cuando no ' +
            'tiene hallazgos abiertos ni en remediación.',
          tags: ['resumen'],
          response: { ...respuestasAuth, 200: Resumen },
        },
      },
      async () => {
        const todos = await repositorio.listar({})
        const abiertos = todos.filter((h) => h.estado === 'Abierto')

        const porSeveridad = { Crítica: 0, Alta: 0, Media: 0, Baja: 0 }
        for (const hallazgo of todos) porSeveridad[hallazgo.severidad] += 1

        return {
          hallazgosAbiertos: abiertos.length,
          porSeveridad,
          controles: catalogo.controles.length,
          marcos: catalogo.marcos.length,
          coberturaPorMarco: calcularCobertura(catalogo, todos),
        }
      },
    )
  }
}
