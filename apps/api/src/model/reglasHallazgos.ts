import type { EstadoHallazgo } from './esquemas.ts'
import type { MotivoRechazo } from './reglasExcepciones.ts'

/** Mínimo de caracteres del comentario al cambiar el estado. */
export const MINIMO_COMENTARIO_ESTADO = 10

/**
 * A qué estados se puede pasar desde cada uno.
 *
 * Es una tabla y no una cadena de `if`s para que se lea de un vistazo, que la
 * documentación la copie tal cual y que agregar un estado obligue a decidir
 * sus transiciones: TypeScript exige una fila por estado.
 *
 * `Excepción` no aparece como destino: solo se llega aprobando una excepción.
 * Si se pudiera marcar a mano, cualquiera se saltaría la aprobación humana.
 */
export const TRANSICIONES: Record<EstadoHallazgo, readonly EstadoHallazgo[]> = {
  Abierto: ['En remediación', 'Cerrado'],
  'En remediación': ['Abierto', 'Cerrado'],
  // Reapertura: por ejemplo, el drift vuelve a detectar el incumplimiento.
  Cerrado: ['Abierto'],
  Excepción: [],
}

export type ResultadoCambioEstado = {
  /** El estado actual no permite ese cambio (409). */
  conflicto: string | null
  /** Lo que está mal en la petición (422). */
  motivos: MotivoRechazo[]
}

/**
 * Valida un cambio de estado. Como `validarDecision`, separa el conflicto con
 * el estado actual (409) de los errores en los datos enviados (422).
 */
export function validarCambioEstado(
  actual: EstadoHallazgo,
  destino: EstadoHallazgo,
  comentario: string,
): ResultadoCambioEstado {
  const motivos: MotivoRechazo[] = []
  let conflicto: string | null = null

  if (destino === 'Excepción') {
    // Es un 422 y no un 409: no depende del estado actual, la petición en sí
    // está pidiendo algo que esta vía nunca hace.
    motivos.push({
      campo: 'estado',
      mensaje: 'Un hallazgo no se marca como Excepción a mano: usa el flujo de excepciones.',
    })
  } else if (actual === destino) {
    conflicto = `El hallazgo ya está en ese estado (${actual}).`
  } else if (!TRANSICIONES[actual].includes(destino)) {
    conflicto = `No se puede pasar de ${actual} a ${destino}.`
  }

  if (comentario.trim().length < MINIMO_COMENTARIO_ESTADO) {
    motivos.push({
      campo: 'comentario',
      mensaje: `El comentario debe tener al menos ${MINIMO_COMENTARIO_ESTADO} caracteres.`,
    })
  }

  return { conflicto, motivos }
}
