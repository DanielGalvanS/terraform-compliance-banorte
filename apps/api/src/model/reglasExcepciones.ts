import type { EstadoExcepcion } from './esquemas.ts'

/** Mínimo de caracteres que el área de Cumplimiento acepta como justificación. */
export const MINIMO_JUSTIFICACION = 30

/** Vigencia máxima que se puede conceder de una vez. */
export const MAXIMO_DIAS_VIGENCIA = 90

const MS_POR_DIA = 86_400_000

export type MotivoRechazo = {
  campo: string
  mensaje: string
}

export function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function hoyIso(ahora: Date = new Date()): string {
  return ahora.toISOString().slice(0, 10)
}

export function diasHasta(venceEl: string, ahora: Date = new Date()): number {
  return Math.round((aFecha(venceEl).getTime() - aFecha(hoyIso(ahora)).getTime()) / MS_POR_DIA)
}

/**
 * Valida una solicitud. Devuelve la lista de motivos; vacía significa válida.
 *
 * Las reglas viven aquí y no en la ruta para poder probarlas sin levantar un
 * servidor, y para que el día que el agente proponga excepciones use las
 * mismas: un camino alterno con reglas más laxas sería la forma más fácil de
 * saltarse el control.
 */
export function validarSolicitud(
  solicitud: { justificacion: string; venceEl: string; control: string },
  controlesConocidos: Set<string>,
  ahora: Date = new Date(),
): MotivoRechazo[] {
  const motivos: MotivoRechazo[] = []

  if (!controlesConocidos.has(solicitud.control)) {
    motivos.push({
      campo: 'control',
      mensaje: `El control ${solicitud.control} no existe en el catálogo.`,
    })
  }

  if (solicitud.justificacion.trim().length < MINIMO_JUSTIFICACION) {
    motivos.push({
      campo: 'justificacion',
      mensaje: `La justificación debe tener al menos ${MINIMO_JUSTIFICACION} caracteres.`,
    })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(solicitud.venceEl)) {
    motivos.push({ campo: 'venceEl', mensaje: 'La fecha debe tener el formato yyyy-mm-dd.' })
  } else {
    const dias = diasHasta(solicitud.venceEl, ahora)
    if (dias < 0) {
      motivos.push({ campo: 'venceEl', mensaje: 'La vigencia no puede estar en el pasado.' })
    } else if (dias > MAXIMO_DIAS_VIGENCIA) {
      motivos.push({
        campo: 'venceEl',
        mensaje: `La vigencia no puede superar ${MAXIMO_DIAS_VIGENCIA} días.`,
      })
    }
  }

  return motivos
}

/**
 * El estado que se muestra, no el que está guardado.
 *
 * Una excepción activa cuya fecha pasó está vencida aunque nadie haya corrido
 * un proceso que la marque. Derivarlo evita que un trabajo programado caído
 * deje excepciones vencidas pareciendo vigentes, que es justo el agujero que
 * un auditor busca.
 */
export function estadoVigente(
  estadoGuardado: EstadoExcepcion,
  venceEl: string,
  ahora: Date = new Date(),
): EstadoExcepcion {
  if (estadoGuardado !== 'Activa' && estadoGuardado !== 'Pendiente') return estadoGuardado
  return diasHasta(venceEl, ahora) < 0 ? 'Vencida' : estadoGuardado
}

/**
 * Mínimo de caracteres del comentario al decidir. La tabla `aprobaciones` lo
 * exige: la decisión sin fundamento no es evidencia.
 */
export const MINIMO_COMENTARIO_DECISION = 10

export type ResultadoDecision = {
  /** El estado de la excepción no permite decidirla (409). */
  conflicto: string | null
  /** Lo que está mal en la petición (422). */
  motivos: MotivoRechazo[]
}

/** Para comparar personas sin que un espacio o una mayúscula las distinga. */
const normalizar = (nombre: string) => nombre.trim().toLocaleLowerCase('es')

/**
 * Valida que una persona pueda aprobar o rechazar una excepción.
 *
 * Separa dos tipos de error porque significan cosas distintas para quien
 * llama: el conflicto es del estado de la excepción (409) y no se arregla
 * corrigiendo la petición; los motivos son de los datos enviados (422) y sí.
 * Los motivos se calculan aunque haya conflicto, para que las pruebas puras
 * vean todo; la ruta decide cuál responder primero.
 */
export function validarDecision(
  guardada: {
    estadoGuardado: EstadoExcepcion
    venceEl: string
    solicitadaPor: string
    solicitanteSujeto?: string | null
  },
  decision: { decididaPor: string; sujeto?: string; comentario: string },
  ahora: Date = new Date(),
): ResultadoDecision {
  // Se usa el estado vigente y no el guardado: una pendiente cuya fecha pasó
  // ya está vencida, y aprobarla daría por buena una vigencia que no existe.
  const estado = estadoVigente(guardada.estadoGuardado, guardada.venceEl, ahora)
  const conflicto =
    estado === 'Pendiente'
      ? null
      : `Solo se decide una excepción pendiente; esta está ${estado}.`

  const motivos: MotivoRechazo[] = []

  // Segregación de funciones: nadie se aprueba a sí mismo. Se compara el
  // identificador del token, que la persona no controla, y también el nombre:
  // basta con que coincida uno para rechazar.
  const mismoSujeto =
    decision.sujeto !== undefined &&
    guardada.solicitanteSujeto != null &&
    decision.sujeto === guardada.solicitanteSujeto
  if (mismoSujeto || normalizar(decision.decididaPor) === normalizar(guardada.solicitadaPor)) {
    motivos.push({
      campo: 'decididaPor',
      mensaje: 'Quien solicitó la excepción no puede decidirla.',
    })
  }

  if (decision.comentario.trim().length < MINIMO_COMENTARIO_DECISION) {
    motivos.push({
      campo: 'comentario',
      mensaje: `El comentario debe tener al menos ${MINIMO_COMENTARIO_DECISION} caracteres.`,
    })
  }

  return { conflicto, motivos }
}

/**
 * Valida una revocación. Solo se revoca lo que está protegiendo algo: una
 * excepción activa y vigente. Una pendiente se rechaza, y una vencida ya no
 * protege nada. Como al decidir, el conflicto (409) va aparte de los datos
 * (422).
 *
 * No hay regla de segregación: revocar reduce el riesgo en vez de aceptarlo,
 * y quien la solicitó debe poder pedir que se retire en cuanto la corrige.
 */
export function validarRevocacion(
  guardada: { estadoGuardado: EstadoExcepcion; venceEl: string },
  comentario: string,
  ahora: Date = new Date(),
): ResultadoDecision {
  const estado = estadoVigente(guardada.estadoGuardado, guardada.venceEl, ahora)
  const conflicto =
    estado === 'Activa' ? null : `Solo se revoca una excepción activa; esta está ${estado}.`
  const motivos: MotivoRechazo[] =
    comentario.trim().length < MINIMO_COMENTARIO_DECISION
      ? [
          {
            campo: 'comentario',
            mensaje: `El motivo debe tener al menos ${MINIMO_COMENTARIO_DECISION} caracteres.`,
          },
        ]
      : []
  return { conflicto, motivos }
}
