/**
 * Marcos regulatorios en alcance.
 *
 * Son los confirmados con el área de Cumplimiento y los únicos a los que
 * `infra/policies/mappings.yaml` mapea cada control. Mostrar otros daría a
 * entender una cobertura que el catálogo no respalda.
 *
 * El reto nombra «NIST SP 800-53 / SOC 2» como un solo marco; aquí van
 * separados porque sus referencias son distintas: NIST numera controles
 * (SC-28, AC-6) y SOC 2 usa criterios (CC6.1).
 */
export const FRAMEWORKS_IN_SCOPE = [
  'CIS GCP',
  'LFPDPPP',
  'NIST 800-53',
  'SOC 2',
] as const

export type Framework = (typeof FRAMEWORKS_IN_SCOPE)[number]
