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

/**
 * Cambio de estado de un hallazgo. `cambiadoPor` viene en el cuerpo porque aún
 * no hay autenticación; cuando exista OIDC saldrá del token. El comentario no
 * lleva mínimo aquí para que la regla responda 422 con `motivos`.
 */
export const CambioEstadoHallazgo = z.object({
  estado: EstadoHallazgo,
  comentario: z.string().describe('Por qué cambia; queda en la evidencia'),
  cambiadoPor: z.string().min(1).describe('Quién lo cambia; saldrá del token con OIDC'),
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
export type EstadoHallazgo = z.infer<typeof EstadoHallazgo>
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
  aprobadaPor: z
    .string()
    .nullable()
    .describe('Quién decidió, aprobando o rechazando; nulo mientras está pendiente'),
  comentarioDecision: z
    .string()
    .nullable()
    .describe('Fundamento de la decisión; nulo mientras está pendiente'),
  decididaEn: z.string().nullable().describe('Fecha ISO 8601; nula mientras está pendiente'),
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

export const TipoEvento = z.enum([
  'excepcion.aprobada',
  'excepcion.rechazada',
  'hallazgo.estado',
  'agente.decision',
])

/**
 * Un evento del registro de evidencia.
 *
 * Cada uno guarda el hash del anterior: alterar uno intermedio rompe su hash y
 * el de todos los que siguen, así que la alteración se detecta en vez de pasar
 * desapercibida.
 */
export const EventoEvidencia = z.object({
  id: z.uuid(),
  secuencia: z.number().int().positive().describe('1, 2, 3… sin huecos'),
  tipo: TipoEvento,
  objetoId: z.string().describe('Id de la excepción o del hallazgo'),
  actor: z.string(),
  detalle: z
    .record(z.string(), z.string())
    .describe('Por ejemplo { de: "Abierto", a: "En remediación", comentario: "…" }'),
  registradoEn: z.string().describe('Fecha ISO 8601'),
  hashAnterior: z.string().describe('sha256 del evento anterior; el primero usa 64 ceros'),
  hash: z.string().describe('sha256 de hashAnterior más el JSON canónico del evento sin hash'),
})

export type TipoEvento = z.infer<typeof TipoEvento>
export type EventoEvidencia = z.infer<typeof EventoEvidencia>

/**
 * Decisiones del agente de cumplimiento (apps/agent).
 *
 * El agente no decide el bloqueo: lo decide la compuerta, y aquí solo se copia
 * su resultado. Lo que el agente aporta es la explicación y la prioridad de
 * cada violación. Los campos siguen `decision.json`, en camelCase.
 */
export const ResultadoCompuerta = z.enum(['conforme', 'bloqueado', 'error'])
export const EstadoDecision = z.enum(['analizado', 'sin_violaciones', 'sin_analisis', 'error_agente'])
export const AccionSugerida = z.enum(['proponer_pr', 'escalar_jira', 'ninguna'])

export const ClasificacionAgente = z.object({
  violacion: z.string().regex(/^V\d{2,}$/).describe('Id de la violación en el veredicto, por ejemplo V01'),
  control: z.string().min(1),
  recurso: z.string().nullable().describe('Dirección de Terraform; nula si el mensaje no la traía'),
  mensaje: z.string().describe('El mensaje de la compuerta, sin cambios'),
  prioridad: z.number().int().min(1).max(5).describe('1 = atender ya'),
  explicacion: z.string(),
  riesgo: z.string(),
  remediacion: z.string(),
  accionSugerida: AccionSugerida,
  confianza: z.number().int().min(0).max(100),
  citas: z.array(z.string()),
})

/** Lo que el agente envía al terminar una ejecución. */
export const NuevaDecision = z.object({
  ejecucionId: z.uuid().describe('Identifica la ejecución; reenviarla no duplica nada'),
  fecha: z.string().describe('Fecha ISO 8601 de la ejecución'),
  origen: Origen,
  ambiente: Ambiente,
  commit: z.string().min(1),
  resultadoCompuerta: ResultadoCompuerta,
  motivoCompuerta: z.string().default(''),
  estado: EstadoDecision,
  resumen: z.string(),
  clasificaciones: z.array(ClasificacionAgente).max(500),
  herramientasUsadas: z.array(z.string()).default([]),
  ajustes: z.array(z.string()).default([]).describe('Correcciones del código a la opinión del modelo'),
  intentosFallidos: z.array(z.string()).default([]),
  modelo: z.string().nullable(),
  versionPrompt: z.string(),
  hashEntradas: z.string().regex(/^sha256:[0-9a-f]{64}$/).describe('Hash del veredicto y el plan analizados'),
  error: z.string().nullable(),
})

export const DecisionAgente = NuevaDecision.extend({
  clasificaciones: z.array(
    ClasificacionAgente.extend({
      hallazgoId: z.uuid().nullable().describe('El hallazgo que registró esta violación'),
    }),
  ),
  registradaEn: z.string().describe('Fecha ISO 8601'),
  evidencia: z.object({
    secuencia: z.number().int().positive(),
    hash: z.string(),
  }).describe('El evento agente.decision que la respalda'),
})

export const FiltroDecisiones = z.object({
  hallazgoId: z.uuid().optional(),
  commit: z.string().optional(),
  estado: EstadoDecision.optional(),
})

export type NuevaDecision = z.infer<typeof NuevaDecision>
export type DecisionAgente = z.infer<typeof DecisionAgente>
export type FiltroDecisiones = z.infer<typeof FiltroDecisiones>
