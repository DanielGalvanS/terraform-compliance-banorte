import { z } from 'zod'
import { Ambiente } from './esquemas.ts'

export const EstadoRecurso = z.enum([
  'Conforme',
  'Advertencia',
  'No conforme',
  'Sin etiqueta',
])

export const Recurso = z.object({
  direccion: z.string().describe('Dirección en Terraform, por ejemplo module.red.google_compute_network.esta'),
  nombre: z.string(),
  tipo: z.string(),
  modulo: z.string(),
  version: z.string(),
  ambiente: Ambiente,
  etiquetas: z.record(z.string(), z.string()),
  etiquetasFaltantes: z.array(z.string()).describe('Claves obligatorias ausentes'),
  estado: EstadoRecurso,
})

export const ResumenInventario = z.object({
  total: z.number().int(),
  modulos: z.number().int(),
  conEtiquetasCompletas: z.number().int(),
  etiquetables: z.number().int().describe('Recursos cuyo tipo admite etiquetas'),
  coberturaEtiquetas: z.number().min(0).max(100),
  noConformes: z.number().int(),
})

export type Recurso = z.infer<typeof Recurso>
export type EstadoRecurso = z.infer<typeof EstadoRecurso>

/** Lo que se guarda de un recurso; el estado y las faltantes se derivan. */
export type RecursoGuardado = Omit<Recurso, 'estado' | 'etiquetasFaltantes'>

/**
 * Estado de cumplimiento de un recurso, calculado.
 *
 * El orden importa: un recurso con un hallazgo abierto es «No conforme»
 * aunque además le falten etiquetas, porque lo primero que hay que atender es
 * el incumplimiento. Que esto se derive —y no se guarde— evita el caso en que
 * un recurso ya remediado siga apareciendo en rojo porque nadie actualizó un
 * campo.
 */
export function estadoDeRecurso(
  faltantes: string[],
  hallazgosDelRecurso: { estado: string }[],
): EstadoRecurso {
  if (hallazgosDelRecurso.some((h) => h.estado === 'Abierto')) return 'No conforme'
  if (faltantes.length > 0) return 'Sin etiqueta'
  if (hallazgosDelRecurso.some((h) => h.estado === 'En remediación')) return 'Advertencia'
  return 'Conforme'
}

/**
 * Claves obligatorias ausentes, solo para los tipos que admiten etiquetas.
 *
 * Las redes, subredes, routers y gateways NAT de GCP no exponen el campo
 * `labels`. Exigírselas marcaría como incumplidores unos recursos que nadie
 * puede arreglar, y un inventario que grita sin razón se acaba ignorando. Es
 * el mismo recorte que hace CO-TAG-01.
 */
export function etiquetasFaltantes(
  etiquetas: Record<string, string>,
  obligatorias: string[],
  tipo?: string,
  tiposEtiquetables?: string[],
): string[] {
  if (tipo !== undefined && tiposEtiquetables !== undefined && !tiposEtiquetables.includes(tipo)) {
    return []
  }
  return obligatorias.filter((clave) => {
    const valor = etiquetas[clave]
    return valor === undefined || valor.trim() === ''
  })
}
