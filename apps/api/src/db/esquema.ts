import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Esquema de la base de cumplimiento.
 *
 * Todas las tablas llevan `id uuid`: los identificadores viajan entre el
 * pipeline, la API y la evidencia, y un entero autoincremental delataría
 * volumen y permitiría adivinar registros ajenos.
 *
 * La base es el índice consultable, no el registro inmutable. El artefacto
 * firmado vive en el bucket con retención; aquí se guarda su hash y su ruta.
 */

export const severidad = pgEnum('severidad', ['Crítica', 'Alta', 'Media', 'Baja'])
export const ambiente = pgEnum('ambiente', ['Dev', 'QA', 'Prod'])
export const estadoHallazgo = pgEnum('estado_hallazgo', [
  'Abierto',
  'En remediación',
  'Excepción',
  'Cerrado',
])
export const veredicto = pgEnum('veredicto', ['conforme', 'bloqueado', 'error'])
export const estadoExcepcion = pgEnum('estado_excepcion', [
  'Pendiente',
  'Activa',
  'Vencida',
  'Rechazada',
  'Revocada',
])

export const marcos = pgTable('marcos', {
  id: uuid('id').primaryKey().defaultRandom(),
  clave: text('clave').notNull().unique(),
  nombre: text('nombre').notNull(),
  nombreCorto: text('nombre_corto').notNull(),
  version: text('version'),
})

export const controles = pgTable('controles', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Identificador del catálogo, por ejemplo CO-NET-01. */
  codigo: text('codigo').notNull().unique(),
  titulo: text('titulo').notNull(),
  descripcion: text('descripcion').notNull(),
  severidad: severidad('severidad').notNull(),
})

/** Mapeo control -> marco. Un control responde a varios marcos a la vez. */
export const controlMarco = pgTable(
  'control_marco',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    controlId: uuid('control_id').notNull().references(() => controles.id),
    marcoId: uuid('marco_id').notNull().references(() => marcos.id),
    referencia: text('referencia').notNull(),
    /** Pendiente de validación por Cumplimiento. */
    porValidar: boolean('por_validar').notNull().default(false),
  },
  (tabla) => [uniqueIndex('control_marco_unico').on(tabla.controlId, tabla.marcoId, tabla.referencia)],
)

export const politicas = pgTable('politicas', {
  id: uuid('id').primaryKey().defaultRandom(),
  controlId: uuid('control_id').notNull().references(() => controles.id),
  /** Ruta del archivo Rego dentro del repositorio. */
  ruta: text('ruta').notNull(),
  revision: text('revision').notNull(),
})

export const recursos = pgTable('recursos', {
  id: uuid('id').primaryKey().defaultRandom(),
  direccion: text('direccion').notNull(),
  tipo: text('tipo').notNull(),
  modulo: text('modulo'),
  ambiente: ambiente('ambiente').notNull(),
  etiquetas: jsonb('etiquetas').$type<Record<string, string>>().notNull().default({}),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
})

/** Una corrida del pipeline sobre un plan concreto. */
export const ejecuciones = pgTable('ejecuciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  commit: text('commit').notNull(),
  pullRequest: integer('pull_request'),
  ambiente: ambiente('ambiente').notNull(),
  veredicto: veredicto('veredicto').notNull(),
  /** Huella del plan que se evaluó; la misma que comprueba el apply. */
  huellaPlan: text('huella_plan').notNull(),
  iniciadaEn: timestamp('iniciada_en', { withTimezone: true }).notNull().defaultNow(),
})

export const hallazgos = pgTable(
  'hallazgos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ejecucionId: uuid('ejecucion_id').references(() => ejecuciones.id),
    controlId: uuid('control_id').references(() => controles.id),
    recursoId: uuid('recurso_id').references(() => recursos.id),
    titulo: text('titulo').notNull(),
    severidad: severidad('severidad').notNull(),
    ambiente: ambiente('ambiente').notNull(),
    origen: text('origen').notNull(),
    estado: estadoHallazgo('estado').notNull().default('Abierto'),
    mensaje: text('mensaje').notNull(),
    detectadoEn: timestamp('detectado_en', { withTimezone: true }).notNull().defaultNow(),
    /** Evita duplicar un hallazgo si el pipeline reintenta. */
    claveIdempotencia: text('clave_idempotencia').unique(),
  },
  (tabla) => [
    index('hallazgos_por_estado').on(tabla.estado, tabla.severidad),
    index('hallazgos_por_ambiente').on(tabla.ambiente),
  ],
)

/** Lo que el agente concluyó, y con qué. Es la trazabilidad del razonamiento. */
export const decisiones = pgTable('decisiones', {
  id: uuid('id').primaryKey().defaultRandom(),
  hallazgoId: uuid('hallazgo_id').references(() => hallazgos.id),
  ejecucionId: uuid('ejecucion_id').references(() => ejecuciones.id),
  resumen: text('resumen').notNull(),
  herramientas: text('herramientas').array().notNull().default([]),
  confianza: integer('confianza'),
  /** Hash del artefacto en el bucket con retención. La base solo lo indexa. */
  hashEvidencia: text('hash_evidencia'),
  rutaEvidencia: text('ruta_evidencia'),
  registradaEn: timestamp('registrada_en', { withTimezone: true }).notNull().defaultNow(),
})

export const aprobaciones = pgTable('aprobaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  decisionId: uuid('decision_id').references(() => decisiones.id),
  ambiente: ambiente('ambiente').notNull(),
  solicitadaA: text('solicitada_a').notNull(),
  resueltaPor: text('resuelta_por'),
  aprobada: boolean('aprobada'),
  /** Obligatorio al resolver: la decisión sin fundamento no es evidencia. */
  comentario: text('comentario'),
  solicitadaEn: timestamp('solicitada_en', { withTimezone: true }).notNull().defaultNow(),
  resueltaEn: timestamp('resuelta_en', { withTimezone: true }),
})

export const remediaciones = pgTable('remediaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  hallazgoId: uuid('hallazgo_id').notNull().references(() => hallazgos.id),
  /** Siempre un pull request: nunca un cambio directo en consola. */
  pullRequest: integer('pull_request'),
  rama: text('rama'),
  aplicada: boolean('aplicada').notNull().default(false),
  propuestaEn: timestamp('propuesta_en', { withTimezone: true }).notNull().defaultNow(),
})

export const excepciones = pgTable('excepciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  controlId: uuid('control_id').notNull().references(() => controles.id),
  recursoId: uuid('recurso_id').references(() => recursos.id),
  ambiente: ambiente('ambiente').notNull(),
  justificacion: text('justificacion').notNull(),
  solicitadaPor: text('solicitada_por').notNull(),
  aprobadaPor: text('aprobada_por'),
  venceEl: date('vence_el').notNull(),
  estado: estadoExcepcion('estado').notNull().default('Pendiente'),
  creadaEn: timestamp('creada_en', { withTimezone: true }).notNull().defaultNow(),
})
