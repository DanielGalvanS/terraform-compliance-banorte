import { z } from 'zod'

/**
 * Esquemas del dominio.
 *
 * Son la única definición: validan la entrada en tiempo de ejecución, dan los
 * tipos en compilación y generan el OpenAPI del que sale el cliente del
 * frontend. Un campo nuevo se declara una vez.
 */

export const Severidad = z.enum(['Crítica', 'Alta', 'Media', 'Baja'])
export const Ambiente = z.enum(['Dev', 'QA', 'Prod'])
export const EstadoHallazgo = z.enum(['Abierto', 'En remediación', 'Excepción', 'Cerrado'])
export const Origen = z.enum(['Plan', 'Drift', 'Evento', 'Auditoría'])

export const Marco = z.object({
  clave: z.string().describe('Identificador interno, por ejemplo cis_gcp'),
  nombre: z.string(),
  nombreCorto: z.string().describe('El nombre que muestran las pantallas'),
  version: z.string().optional(),
  ambito: z.string().optional(),
})

export const ReferenciaMarco = z.object({
  marco: z.string(),
  referencia: z.string(),
  titulo: z.string(),
  porValidar: z.boolean().describe('Pendiente de validación por Cumplimiento'),
})

export const Control = z.object({
  codigo: z.string().describe('Identificador del catálogo, por ejemplo CO-NET-01'),
  titulo: z.string(),
  descripcion: z.string(),
  severidad: Severidad,
  casoDePrueba: z.string().optional(),
  mapeo: z.array(ReferenciaMarco),
})

export const Hallazgo = z.object({
  id: z.uuid(),
  control: z.string().nullable().describe('Código del control; nulo si ninguna política lo cubre'),
  titulo: z.string(),
  recurso: z.string(),
  severidad: Severidad,
  ambiente: Ambiente,
  origen: Origen,
  estado: EstadoHallazgo,
  mensaje: z.string(),
  detectadoEn: z.string().describe('Fecha ISO 8601'),
})

/** Lo que el pipeline envía al detectar un incumplimiento. */
export const NuevoHallazgo = z.object({
  control: z.string().nullable().default(null),
  titulo: z.string().min(1),
  recurso: z.string().min(1),
  severidad: Severidad,
  ambiente: Ambiente,
  origen: Origen,
  mensaje: z.string().min(1),
})

export const FiltroHallazgos = z.object({
  severidad: Severidad.optional(),
  ambiente: Ambiente.optional(),
  estado: EstadoHallazgo.optional(),
  control: z.string().optional(),
})

export const Resumen = z.object({
  hallazgosAbiertos: z.number().int(),
  porSeveridad: z.record(Severidad, z.number().int()),
  controles: z.number().int(),
  marcos: z.number().int(),
})

export const Error = z.object({
  error: z.string(),
  detalle: z.string().optional(),
})

export type Marco = z.infer<typeof Marco>
export type Control = z.infer<typeof Control>
export type Hallazgo = z.infer<typeof Hallazgo>
export type NuevoHallazgo = z.infer<typeof NuevoHallazgo>
export type FiltroHallazgos = z.infer<typeof FiltroHallazgos>
