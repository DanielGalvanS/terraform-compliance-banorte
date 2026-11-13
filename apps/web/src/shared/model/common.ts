/**
 * Vocabulary shared by every feature.
 *
 * Domain values (severity, environment, state) live here; the visual `Tone`
 * they map to is derived, never stored alongside the data. Fixtures therefore
 * describe facts, and presentation stays a pure function of those facts.
 */

export type Environment = 'Dev' | 'QA' | 'Prod'

export const ENVIRONMENTS: Environment[] = ['Dev', 'QA', 'Prod']

export type Severity = 'Crítica' | 'Alta' | 'Media' | 'Baja'

export const SEVERITIES: Severity[] = ['Crítica', 'Alta', 'Media', 'Baja']

/** Visual weight used by badges, dots and status rings. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'high' | 'critical'

const SEVERITY_TONES: Record<Severity, Tone> = {
  Crítica: 'critical',
  Alta: 'high',
  Media: 'warning',
  Baja: 'neutral',
}

export function severityTone(severity: Severity): Tone {
  return SEVERITY_TONES[severity]
}

/** Production is called out everywhere; the other environments read as neutral. */
export function environmentTone(environment: Environment | string): Tone {
  return environment === 'Prod' ? 'critical' : 'info'
}
