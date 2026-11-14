import type { HallazgoApi } from '@/shared/api'
import type { Finding } from '../model'

/**
 * Traduce un hallazgo de la API al modelo de la pantalla.
 *
 * Existe para que el contrato de la API y el modelo del frontend puedan
 * evolucionar por separado. Sin esta capa, cada renombrado de un campo en la
 * API obligaría a tocar componentes.
 */
export function desdeApi(hallazgo: HallazgoApi): Finding {
  const detalle = hallazgo.detalle

  return {
    id: hallazgo.id,
    severity: hallazgo.severidad,
    title: hallazgo.titulo,
    resource: hallazgo.recurso,
    ...(hallazgo.control === null ? {} : { catalogControl: hallazgo.control }),
    framework: detalle?.controlViolado.codigo.split(' ').slice(0, -1).join(' ') || 'Catálogo',
    control: detalle?.controlViolado.codigo.split(' ').at(-1) ?? hallazgo.control ?? '—',
    origin: hallazgo.origen,
    environment: hallazgo.ambiente,
    state: estadoDePantalla(hallazgo.estado),
    detectedAtLabel: new Date(hallazgo.detectadoEn).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    violatedControl: {
      code: detalle?.controlViolado.codigo ?? hallazgo.control ?? 'Sin control',
      statement: detalle?.controlViolado.enunciado ?? hallazgo.mensaje,
      equivalents: detalle?.controlViolado.equivalentes ?? [],
    },
    evidence: detalle?.evidencia ?? hallazgo.mensaje,
    explanation: {
      text: detalle?.explicacion.texto ?? hallazgo.mensaje,
      confidencePercent: detalle?.explicacion.confianza ?? 0,
      engine: detalle?.explicacion.motor ?? 'Conftest',
    },
    remediation: {
      removed: detalle?.remediacion.quitadas ?? [],
      added: detalle?.remediacion.anadidas ?? [],
    },
  }
}

/** La API contempla «Cerrado», que la tabla no distingue de «Excepción». */
function estadoDePantalla(estado: HallazgoApi['estado']): Finding['state'] {
  return estado === 'Cerrado' ? 'Excepción' : estado
}
