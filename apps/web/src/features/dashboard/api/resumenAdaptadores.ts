import type { RespuestaResumen } from '@/shared/api'
import type { FrameworkScore, Kpi } from '../model'

/** Bajo esta cobertura el gráfico dibuja el marco como advertencia. */
export const UMBRAL_ADVERTENCIA = 90

/**
 * Sustituye la tarjeta de hallazgos abiertos por las cifras de la API.
 *
 * Las demás tarjetas del tablero —validación pre-apply, drift, costo— se
 * quedan con los datos de ejemplo: la API todavía no puede responderlas, y
 * mezclar cifras reales con inventadas sin distinguirlas sería peor que no
 * conectar nada.
 */
export function conHallazgosReales(kpis: Kpi[], resumen: RespuestaResumen): Kpi[] {
  return kpis.map((kpi) =>
    kpi.id === 'open-findings'
      ? {
          ...kpi,
          value: String(resumen.hallazgosAbiertos),
          severityBreakdown: {
            critical: resumen.porSeveridad['Crítica'] ?? 0,
            high: resumen.porSeveridad.Alta ?? 0,
            medium: resumen.porSeveridad.Media ?? 0,
          },
        }
      : kpi,
  )
}

export function coberturaComoGrafico(resumen: RespuestaResumen): FrameworkScore[] {
  return resumen.coberturaPorMarco.map((cobertura) => ({
    framework: cobertura.marco,
    score: cobertura.porcentaje,
  }))
}
