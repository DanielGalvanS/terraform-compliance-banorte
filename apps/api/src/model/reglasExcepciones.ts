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
