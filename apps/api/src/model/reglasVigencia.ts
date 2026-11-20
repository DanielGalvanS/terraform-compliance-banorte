import type { EstadoExcepcion, EstadoHallazgo, Hallazgo } from './esquemas.ts'
import { coincideRecurso } from './recursos.ts'
import { diasHasta, estadoVigente } from './reglasExcepciones.ts'

/** Con cuántos días de anticipación una excepción activa se marca «por vencer». */
export const DIAS_AVISO_VENCIMIENTO = 7

/** Lo mínimo de una excepción guardada que hace falta para saber qué cubre. */
export type ExcepcionVigencia = {
  id: string
  codigo: string
  control: string
  recurso: string
  ambiente: Hallazgo['ambiente']
  estadoGuardado: EstadoExcepcion
  venceEl: string
}

/** Lo mínimo de un hallazgo para saber si lo cubre una excepción. */
export type HallazgoVigencia = {
  control: string | null
  recurso: string
  ambiente: Hallazgo['ambiente']
  estado: EstadoHallazgo
}

/**
 * Días hasta el vencimiento, solo mientras la excepción sigue viva (Pendiente
 * o Activa). Una rechazada, revocada o vencida ya no tiene cuenta regresiva.
 */
export function diasRestantes(
  excepcion: Pick<ExcepcionVigencia, 'estadoGuardado' | 'venceEl'>,
  ahora: Date = new Date(),
): number | null {
  const estado = estadoVigente(excepcion.estadoGuardado, excepcion.venceEl, ahora)
  return estado === 'Activa' || estado === 'Pendiente' ? diasHasta(excepcion.venceEl, ahora) : null
}

/** Activa y a {@link DIAS_AVISO_VENCIMIENTO} días o menos de vencer. */
export function porVencer(
  excepcion: Pick<ExcepcionVigencia, 'estadoGuardado' | 'venceEl'>,
  ahora: Date = new Date(),
): boolean {
  if (estadoVigente(excepcion.estadoGuardado, excepcion.venceEl, ahora) !== 'Activa') return false
  return diasHasta(excepcion.venceEl, ahora) <= DIAS_AVISO_VENCIMIENTO
}

/**
 * Si la excepción habla del mismo incumplimiento que el hallazgo: mismo
 * control, mismo ambiente y el mismo recurso. El ambiente cuenta: una
 * excepción aceptada en Dev no dice nada de Prod.
 */
export function cubre(
  excepcion: Pick<ExcepcionVigencia, 'control' | 'recurso' | 'ambiente'>,
  hallazgo: Pick<HallazgoVigencia, 'control' | 'recurso' | 'ambiente'>,
): boolean {
  return (
    hallazgo.control !== null &&
    excepcion.control === hallazgo.control &&
    excepcion.ambiente === hallazgo.ambiente &&
    coincideRecurso(excepcion.recurso, hallazgo.recurso)
  )
}

/** La excepción activa y vigente que cubre al hallazgo, si hay una. */
export function excepcionQueCubre<E extends ExcepcionVigencia>(
  hallazgo: HallazgoVigencia,
  excepciones: readonly E[],
  ahora: Date = new Date(),
): E | null {
  return (
    excepciones.find(
      (e) => estadoVigente(e.estadoGuardado, e.venceEl, ahora) === 'Activa' && cubre(e, hallazgo),
    ) ?? null
  )
}

/**
 * El estado que se muestra de un hallazgo, no el que está guardado.
 *
 * Mientras una excepción activa y vigente lo cubre, un hallazgo abierto o en
 * remediación se muestra como `Excepción`. Se deriva al leer, igual que
 * `estadoVigente`: el día que la excepción vence o se revoca, el hallazgo
 * vuelve solo a su estado, sin depender de un proceso programado que alguien
 * pueda olvidar. Por eso el hallazgo nunca guarda `Excepción` y no hay que
 * «desmarcarlo».
 *
 * Un hallazgo cerrado se queda cerrado: la excepción no lo reabre.
 */
export function estadoMostrado(guardado: EstadoHallazgo, cubierto: boolean): EstadoHallazgo {
  return cubierto && (guardado === 'Abierto' || guardado === 'En remediación') ? 'Excepción' : guardado
}
