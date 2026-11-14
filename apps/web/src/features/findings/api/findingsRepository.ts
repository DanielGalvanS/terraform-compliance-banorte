import { SEVERITIES, type Severity } from '@/shared/model'
import { filterOptions, unique } from '@/shared/lib'
import { findings, findingsSummary } from '../data/findings.fixture'
import type { Finding, FindingsSummary } from '../model'

/**
 * Sentinel values for "no filter". Each one doubles as the option label shown
 * in the select, which is why they are not a single shared constant.
 */
export const ANY = {
  severity: 'Todas',
  framework: 'Todos los marcos',
  control: 'Todos los controles',
  environment: 'Todos',
  origin: 'Todos',
  state: 'Todos',
} as const

export type FindingFilterKey = keyof typeof ANY

export type FindingFilters = Record<FindingFilterKey, string>

export const defaultFindingFilters: FindingFilters = { ...ANY }

export const findingsRepository = {
  getFindings: (): Finding[] => findings,
  getSummary: (): FindingsSummary => findingsSummary,

  /** Options come from the data itself, so a filter can never show a dead end. */
  getFilterOptions(rows: Finding[] = findings): Record<FindingFilterKey, string[]> {
    return {
      severity: [ANY.severity, ...(SEVERITIES as Severity[])],
      framework: filterOptions(ANY.framework, rows.map((f) => f.framework)),
      control: filterOptions(ANY.control, rows.map((f) => f.control)),
      environment: filterOptions(ANY.environment, rows.map((f) => f.environment)),
      origin: filterOptions(ANY.origin, rows.map((f) => f.origin)),
      state: filterOptions(ANY.state, unique(rows.map((f) => f.state))),
    }
  },

  /** Filtra la lista recibida; la fuente puede ser la API o los ejemplos. */
  query(filters: FindingFilters, rows: Finding[] = findings): Finding[] {
    return rows.filter(
      (finding) =>
        (filters.severity === ANY.severity || finding.severity === filters.severity) &&
        (filters.framework === ANY.framework || finding.framework === filters.framework) &&
        (filters.control === ANY.control || finding.control === filters.control) &&
        (filters.environment === ANY.environment ||
          finding.environment === filters.environment) &&
        (filters.origin === ANY.origin || finding.origin === filters.origin) &&
        (filters.state === ANY.state || finding.state === filters.state),
    )
  },
}
