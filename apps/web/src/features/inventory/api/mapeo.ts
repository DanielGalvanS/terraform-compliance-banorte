import type { RecursoApi } from '@/shared/api'
import type { ComplianceState, Resource } from '../model'
import type { Tag } from '@/shared/ui'

/**
 * Traduce un recurso de la API al modelo de la tabla.
 *
 * Las etiquetas faltantes las decide la API, no se recalculan aquí. Si la
 * pantalla las dedujera por su cuenta, un recurso cuyo tipo no admite
 * etiquetas aparecería «Conforme» y con las cinco marcadas como ausentes a la
 * vez, que es exactamente la contradicción que este mapeo evita.
 */
export function desdeApi(recurso: RecursoApi): Resource {
  const declaradas: Tag[] = Object.entries(recurso.etiquetas)
    .filter(([, valor]) => valor.trim() !== '')
    .map(([clave, valor]) => ({ text: `${clave}:${valor}` }))

  const ausentes: Tag[] = recurso.etiquetasFaltantes.map((clave) => ({
    text: `+ ${clave}`,
    missing: true,
  }))

  return {
    name: recurso.nombre,
    module: recurso.modulo,
    moduleVersion: recurso.version,
    environment: recurso.ambiente,
    state: recurso.estado as ComplianceState,
    tags: [...declaradas, ...ausentes],
  }
}
