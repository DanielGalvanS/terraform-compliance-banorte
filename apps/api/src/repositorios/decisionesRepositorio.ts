import type { DecisionAgente, FiltroDecisiones } from '../model/esquemas.ts'

/**
 * Decisiones del agente. Como la evidencia, solo se agregan: una decisión es
 * lo que el agente concluyó en ese momento, y corregirla después la volvería
 * inútil para reconstruir qué se sabía cuando se bloqueó un cambio.
 *
 * Con Postgres irá a la tabla `decisiones` de `db/esquema.ts` (una fila por
 * clasificación, ligada a su hallazgo).
 */
export type DecisionesRepositorio = {
  guardar(decision: DecisionAgente): Promise<DecisionAgente>
  obtener(ejecucionId: string): Promise<DecisionAgente | null>
  /** De la más reciente a la más antigua. */
  listar(filtro: FiltroDecisiones): Promise<DecisionAgente[]>
}

export function decisionesEnMemoria(): DecisionesRepositorio {
  const decisiones: DecisionAgente[] = []

  return {
    async guardar(decision) {
      decisiones.push(decision)
      return decision
    },

    async obtener(ejecucionId) {
      return decisiones.find((d) => d.ejecucionId === ejecucionId) ?? null
    },

    async listar(filtro) {
      return decisiones
        .filter(
          (d) =>
            (filtro.commit === undefined || d.commit === filtro.commit) &&
            (filtro.estado === undefined || d.estado === filtro.estado) &&
            (filtro.hallazgoId === undefined ||
              d.clasificaciones.some((c) => c.hallazgoId === filtro.hallazgoId)),
        )
        .reverse()
    },
  }
}
