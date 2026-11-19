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


/** El control violado, tal como lo explica el catálogo. */
export const ControlViolado = z.object({
  codigo: z.string(),
  enunciado: z.string(),
  equivalentes: z.array(z.string()).describe('Referencias del mismo control en otros marcos'),
})

export const ExplicacionAgente = z.object({
  texto: z.string(),
  confianza: z.number().int().min(0).max(100),
  motor: z.string().describe('Herramientas que produjeron el veredicto'),
})

/** Cambio de Terraform propuesto, como líneas quitadas y añadidas. */
export const Remediacion = z.object({
  quitadas: z.array(z.string()),
  anadidas: z.array(z.string()),
})

/**
 * Lo que el panel de detalle necesita para explicar un hallazgo.
 *
 * Va dentro del mismo objeto y no en otra llamada: son datos pequeños que
 * siempre se piden juntos, y una segunda petición solo añadiría latencia y un
 * estado de carga más que manejar.
 */
export const DetalleHallazgo = z.object({
  controlViolado: ControlViolado,
  evidencia: z.string().describe('Extracto del plan que prueba el hallazgo'),
  explicacion: ExplicacionAgente,
  remediacion: Remediacion,
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
  detalle: DetalleHallazgo.optional(),
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

/**
 * Cobertura de un marco: qué proporción de sus controles no tiene hallazgos
 * abiertos. Se calcula, no se declara: un porcentaje escrito a mano no
 * resiste la pregunta «¿de dónde sale ese número?».
 */
export const CoberturaMarco = z.object({
  marco: z.string(),
  controles: z.number().int().describe('Controles del catálogo mapeados a este marco'),
  conformes: z.number().int().describe('Controles sin hallazgos abiertos'),
  porcentaje: z.number().min(0).max(100),
})

export const Resumen = z.object({
  hallazgosAbiertos: z.number().int(),
  porSeveridad: z.record(Severidad, z.number().int()),
  controles: z.number().int(),
  marcos: z.number().int(),
  coberturaPorMarco: z.array(CoberturaMarco),
})

export const Error = z.object({
  error: z.string(),
  detalle: z.string().optional(),
})

export type Marco = z.infer<typeof Marco>
export type Control = z.infer<typeof Control>
export type Hallazgo = z.infer<typeof Hallazgo>
export type DetalleHallazgo = z.infer<typeof DetalleHallazgo>
export type NuevoHallazgo = z.infer<typeof NuevoHallazgo>
export type FiltroHallazgos = z.infer<typeof FiltroHallazgos>
export type Resumen = z.infer<typeof Resumen>
export type CoberturaMarco = z.infer<typeof CoberturaMarco>

export const EstadoExcepcion = z.enum([
  'Pendiente',
  'Activa',
  'Vencida',
  'Rechazada',
  'Revocada',
])

export const Excepcion = z.object({
  id: z.uuid(),
  codigo: z.string().describe('Identificador legible, por ejemplo EXC-1048'),
  control: z.string().describe('Código del catálogo, por ejemplo CO-NET-01'),
  controlNombre: z.string(),
  marco: z.string(),
  severidad: Severidad,
  recurso: z.string(),
  ambiente: Ambiente,
  justificacion: z.string(),
  solicitadaPor: z.string(),
  aprobadorSolicitado: z
    .string()
    .describe('A quién se le pidió la aprobación; puede no ser quien termine decidiendo'),
  aprobadaPor: z.string().nullable(),
  solicitadaEn: z.string().describe('Fecha ISO 8601'),
  venceEl: z.string().describe('Fecha yyyy-mm-dd'),
  estado: EstadoExcepcion,
  planRemediacion: z.string().nullable(),
})

/**
 * Solicitud de excepción.
 *
 * No incluye estado ni severidad: el estado siempre nace «Pendiente» —nada se
 * exceptúa sin que una persona lo apruebe— y la severidad la decide el
 * control, no quien la pide.
 */
export const NuevaExcepcion = z.object({
  control: z.string().min(1),
  recurso: z.string().min(1),
  ambiente: Ambiente,
  justificacion: z.string(),
  venceEl: z.string(),
  aprobador: z.string().min(1).describe('A quién se le pide la aprobación'),
  // Viene en el cuerpo porque aún no hay autenticación. Cuando exista OIDC
  // (ver «Autenticación» en el README) saldrá del token: dejar que el cliente
  // declare quién es permitiría solicitar a nombre de otro.
  solicitante: z.string().min(1).describe('Quién solicita la excepción'),
  planRemediacion: z.string().optional(),
})

export const FiltroExcepciones = z.object({
  estado: EstadoExcepcion.optional(),
  ambiente: Ambiente.optional(),
  control: z.string().optional(),
})

export type Excepcion = z.infer<typeof Excepcion>
export type NuevaExcepcion = z.infer<typeof NuevaExcepcion>
export type FiltroExcepciones = z.infer<typeof FiltroExcepciones>
export type EstadoExcepcion = z.infer<typeof EstadoExcepcion>
