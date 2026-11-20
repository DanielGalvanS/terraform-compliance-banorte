import { filterOptions } from '@/shared/lib'
import { ENVIRONMENTS, SEVERITIES } from '@/shared/model'
import {
  approvers,
  controlCatalog,
  exceptions,
  resourceCatalog,
} from '../data/exceptions.fixture'
import { daysUntil, EXPIRING_SOON_DAYS } from '../model/expiry'
import {
  EXCEPTION_STATES,
  type ComplianceException,
  type ControlOption,
  type ExceptionStat,
  type NewExceptionInput,
} from '../model'

export const ANY = {
  state: 'Todos',
  framework: 'Todos',
  severity: 'Todas',
  environment: 'Todos',
} as const

export type ExceptionFilterKey = keyof typeof ANY

export type ExceptionFilters = Record<ExceptionFilterKey, string>

export const defaultExceptionFilters: ExceptionFilters = { ...ANY }

export type ExceptionQuery = {
  filters: ExceptionFilters
  search: string
}

export const exceptionsRepository = {
  list: (): ComplianceException[] => exceptions,

  getControlCatalog: (): ControlOption[] => controlCatalog,
  getResourceCatalog: (): string[] => resourceCatalog,
  getApprovers: (): string[] => approvers,

  findControl: (code: string): ControlOption | undefined =>
    controlCatalog.find((control) => control.code === code),

  getFilterOptions(): Record<ExceptionFilterKey, string[]> {
    return {
      state: [ANY.state, ...EXCEPTION_STATES],
      framework: filterOptions(ANY.framework, controlCatalog.map((c) => c.framework)),
      severity: [ANY.severity, ...SEVERITIES],
      environment: [ANY.environment, ...ENVIRONMENTS],
    }
  },

  /** Text search covers resource, control code and control name. */
  query(rows: ComplianceException[], { filters, search }: ExceptionQuery): ComplianceException[] {
    const needle = search.trim().toLowerCase()
    return rows.filter(
      (row) =>
        (filters.state === ANY.state || row.state === filters.state) &&
        (filters.framework === ANY.framework || row.framework === filters.framework) &&
        (filters.severity === ANY.severity || row.severity === filters.severity) &&
        (filters.environment === ANY.environment || row.environment === filters.environment) &&
        `${row.resource} ${row.controlCode} ${row.controlName}`.toLowerCase().includes(needle),
    )
  },

  /** Headline counts, derived from the rows so they can never disagree. */
  getStats(rows: ComplianceException[]): ExceptionStat[] {
    const active = rows.filter((row) => row.state === 'Activa')
    return [
      { label: 'Activas', value: active.length, tone: 'success' },
      {
        label: `Por vencer · ${EXPIRING_SOON_DAYS} días`,
        value: active.filter((row) => {
          // Con API, el dato de la API; sin ella, el cálculo local de siempre.
          if (row.expiringSoon !== undefined) return row.expiringSoon
          const days = daysUntil(row.expiresOn)
          return days >= 0 && days <= EXPIRING_SOON_DAYS
        }).length,
        tone: 'warning',
      },
      {
        label: 'Vencidas',
        value: rows.filter((row) => row.state === 'Vencida').length,
        tone: 'critical',
      },
      {
        label: 'Pendientes de aprobación',
        value: rows.filter((row) => row.state === 'Pendiente').length,
        tone: 'info',
      },
    ]
  },

  /**
   * Turns a validated form submission into an exception request. It always
   * starts as `Pendiente`: nothing is waived without a human approval.
   */
  build(input: NewExceptionInput, existing: ComplianceException[], requestedBy: string) {
    const control = exceptionsRepository.findControl(input.control)
    const nextNumber = 1049 + existing.length
    const exception: ComplianceException = {
      id: `EXC-${nextNumber}`,
      controlCode: input.control,
      controlName: control?.name ?? '',
      framework: control?.framework ?? '',
      resource: input.resource,
      environment: input.environment,
      severity: control?.severity ?? 'Media',
      justification: input.justification.trim(),
      approver: input.approver,
      requestedBy,
      requestedAtLabel: 'hace unos segundos',
      expiresOn: input.expiresOn,
      state: 'Pendiente',
      ...(input.remediationPlan.trim() ? { remediationPlan: input.remediationPlan.trim() } : {}),
    }
    return exception
  },
}
