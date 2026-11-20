import type { EventoEvidenciaApi } from '@/shared/api'
import type { EvidenceEntry } from '../model'

/** Qué ocurrió, en palabras, según el tipo de evento. */
const DESCRIPCIONES: Record<EventoEvidenciaApi['tipo'], string> = {
  'excepcion.aprobada': 'Excepción aprobada',
  'excepcion.rechazada': 'Excepción rechazada',
  'hallazgo.estado': 'Cambio de estado de hallazgo',
}

/**
 * Un hash completo son 71 caracteres y la columna no los aguanta. Se muestran
 * las primeras y las últimas, que es lo que se usa para cotejar a ojo.
 */
export function hashCorto(hash: string): string {
  const digest = hash.replace(/^sha256:/, '')
  return `sha256:${digest.slice(0, 5)}…${digest.slice(-4)}`
}

/**
 * Traduce un evento de la API al modelo de la pantalla.
 *
 * `detalle` es un diccionario abierto: el evento de un cambio de estado trae
 * `de` y `a`, el de una excepción no. Se añaden al texto cuando están, en vez
 * de asumir una forma fija que el día de mañana no se cumpla.
 */
export function desdeApi(evento: EventoEvidenciaApi): EvidenceEntry {
  const transicion =
    evento.detalle['de'] !== undefined && evento.detalle['a'] !== undefined
      ? `: ${evento.detalle['de']} → ${evento.detalle['a']}`
      : ''

  return {
    id: `EV-${String(evento.secuencia).padStart(4, '0')}`,
    description: `${DESCRIPCIONES[evento.tipo]}${transicion}`,
    dateLabel: new Date(evento.registradoEn).toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    hash: hashCorto(evento.hash),
    source: evento.actor,
  }
}
