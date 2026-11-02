export type EvidenceEntry = {
  id: string
  description: string
  dateLabel: string
  /** Integrity hash stored with the artefact. */
  hash: string
  source: string
}

export type EvidenceCoverage = {
  periodLabel: string
  completed: number
  pending: number
  invalid: number
}

export type ReportOptions = {
  frameworks: string[]
  environments: string[]
  periods: string[]
}

export type ExportFormat = {
  id: string
  title: string
  description: string
}
