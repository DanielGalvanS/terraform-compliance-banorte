import type { Environment, Tone } from '@/shared/model'
import type { Tag } from '@/shared/ui'

/**
 * Las cinco etiquetas obligatorias, en el orden en que se muestran.
 *
 * Las claves van sin acentos porque GCP solo admite minúsculas, números,
 * guiones y guiones bajos en las claves de etiqueta: `dueño` sería inválido.
 * Esta lista es la misma que exige la política CO-TAG-01 y que validan los
 * módulos de Terraform, así que un cambio aquí debe acompañar a uno allá.
 */
export const MANDATORY_TAG_KEYS = [
  'duenio',
  'ambiente',
  'clasificacion_datos',
  'centro_costos',
  'marco_aplicable',
] as const

export type MandatoryTagKey = (typeof MANDATORY_TAG_KEYS)[number]

/** Valores declarados en un recurso; la clave ausente es un incumplimiento. */
export type TagValues = Partial<Record<MandatoryTagKey, string>>

/**
 * Convierte los valores en etiquetas para la tabla. Una clave sin valor se
 * marca como faltante en vez de omitirse, que es lo que hace visible el
 * hallazgo de CO-TAG-01.
 */
export function tagsFromValues(values: TagValues): Tag[] {
  return MANDATORY_TAG_KEYS.map((key) => {
    const value = values[key]
    return value === undefined
      ? { text: `+ ${key}`, missing: true }
      : { text: `${key}:${value}` }
  })
}

export type ComplianceState = 'Conforme' | 'Advertencia' | 'No conforme' | 'Sin etiqueta'

const COMPLIANCE_TONES: Record<ComplianceState, Tone> = {
  Conforme: 'success',
  Advertencia: 'warning',
  'No conforme': 'critical',
  'Sin etiqueta': 'critical',
}

export function complianceTone(state: ComplianceState): Tone {
  return COMPLIANCE_TONES[state]
}

export type Resource = {
  name: string
  module: string
  moduleVersion: string
  environment: Environment
  state: ComplianceState
  /** Mandatory tags, with the absent ones flagged. */
  tags: Tag[]
}

export type TerraformModule = {
  name: string
  resourceCount: number
  icon: 'inventory' | 'shield' | 'cloud'
}

export type InventorySummary = {
  label: string
  value: string
  footnote: string
  /** Draws the footnote as a warning. */
  alert?: boolean
}

export type NetworkTopology = {
  environment: Environment
  region: string
  gateway: { name: string; detail: string }
  vpc: {
    name: string
    subnets: { name: string; cidr: string }[]
    services: string[]
  }
  vpn: { name: string; detail: string }
}
