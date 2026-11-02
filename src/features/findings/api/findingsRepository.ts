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
  getFilterOptions(): Record<FindingFilterKey, string[]> {
    return {
      severity: [ANY.severity, ...(SEVERITIES as Severity[])],
      framework: filterOptions(ANY.framework, findings.map((f) => f.framework)),
      control: filterOptions(ANY.control, findings.map((f) => f.control)),
      environment: filterOptions(ANY.environment, findings.map((f) => f.environment)),
      origin: filterOptions(ANY.origin, findings.map((f) => f.origin)),
      state: filterOptions(ANY.state, unique(findings.map((f) => f.state))),
    }
  },

  query(filters: FindingFilters): Finding[] {
    return findings.filter(
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
