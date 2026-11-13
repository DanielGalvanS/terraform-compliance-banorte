import type { Environment, Severity } from '@/shared/model'

export type FindingOrigin = 'Plan' | 'Drift' | 'Evento' | 'Auditoría'

export type FindingState = 'Abierto' | 'En remediación' | 'Excepción'

/** The control a finding violates, plus its equivalents in other frameworks. */
export type ViolatedControl = {
  code: string
  statement: string
  equivalents: string[]
}

export type AgentExplanation = {
  text: string
  confidencePercent: number
  /** Engines that produced the verdict, e.g. OPA + Checkov. */
  engine: string
}

/** Proposed Terraform change, as removed and added lines. */
export type RemediationDiff = {
  removed: string[]
  added: string[]
}

export type Finding = {
  id: string
  severity: Severity
  title: string
  resource: string
  framework: string
  control: string
  origin: FindingOrigin
  environment: Environment
  state: FindingState
  detectedAtLabel: string
  violatedControl: ViolatedControl
  /** Terraform excerpt that proves the finding. */
  evidence: string
  explanation: AgentExplanation
  remediation: RemediationDiff
}

export type SeverityCount = {
  severity: Severity
  count: number
}

export type FindingsSummary = {
  counts: SeverityCount[]
  totalLabel: string
}
