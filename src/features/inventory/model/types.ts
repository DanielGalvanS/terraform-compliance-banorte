import type { Environment, Tone } from '@/shared/model'
import type { Tag } from '@/shared/ui'

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
