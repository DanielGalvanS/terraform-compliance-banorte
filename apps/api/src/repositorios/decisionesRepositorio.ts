import { randomUUID } from 'node:crypto'
import type { DecisionAgente, FiltroDecisiones } from '../model/esquemas.ts'

/**
 * Decisiones del agente. Corresponde a la tabla `decisiones` de `db/esquema.ts`.
 *
 * Solo se agrega: una decisión registrada no se edita. Si el agente se
 * equivocó, la corrección es una ejecución nueva, y las dos quedan.
 */
export type DecisionesRepositorio = {
  crear(datos: Omit<DecisionAgente, 'id' | 'registradaEn'>): Promise<DecisionAgente>
  obtener(id: string): Promise<DecisionAgente | null>
  porEjecucion(ejecucionId: string): Promise<DecisionAgente | null>
  /** De la más reciente a la más antigua. */
  listar(filtro: FiltroDecisiones): Promise<DecisionAgente[]>
}

export function decisionesEnMemoria(): DecisionesRepositorio {
  const decisiones: DecisionAgente[] = []

  return {
    async crear(datos) {
      const decision: DecisionAgente = {
        ...datos,
        id: randomUUID(),
        registradaEn: new Date().toISOString(),
      }
      decisiones.push(decision)
      return decision
    },

    async obtener(id) {
      return decisiones.find((d) => d.id === id) ?? null
    },

    async porEjecucion(ejecucionId) {
      return decisiones.find((d) => d.ejecucionId === ejecucionId) ?? null
    },

    async listar(filtro) {
      return decisiones
        .filter(
          (d) =>
            (filtro.ejecucionId === undefined || d.ejecucionId === filtro.ejecucionId) &&
            (filtro.estado === undefined || d.estado === filtro.estado),
        )
        .reverse()
    },
  }
}
