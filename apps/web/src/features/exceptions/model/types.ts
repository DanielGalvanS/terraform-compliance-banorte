import type { Environment, Severity, Tone } from '@/shared/model'

export type ExceptionState = 'Pendiente' | 'Activa' | 'Vencida' | 'Rechazada' | 'Revocada'

export const EXCEPTION_STATES: ExceptionState[] = [
  'Pendiente',
  'Activa',
  'Vencida',
  'Rechazada',
  'Revocada',
]

const STATE_TONES: Record<ExceptionState, Tone> = {
  Pendiente: 'warning',
  Activa: 'success',
  Vencida: 'critical',
  Rechazada: 'critical',
  Revocada: 'neutral',
}

export function exceptionStateTone(state: ExceptionState): Tone {
  return STATE_TONES[state]
}

/** A control that may be waived, with the framework and risk it carries. */
export type ControlOption = {
  code: string
  name: string
  framework: string
  severity: Severity
}

export type ComplianceException = {
  id: string
  controlCode: string
  controlName: string
  framework: string
  resource: string
  environment: Environment
  severity: Severity
  justification: string
  approver: string
  requestedBy: string
  requestedAtLabel: string
  /** ISO date (yyyy-mm-dd) the waiver stops being valid. */
  expiresOn: string
  state: ExceptionState
  /** Remediation ticket that will close the exception. */
  remediationPlan?: string
  /**
   * Lo que calcula la API. Sin API no existen y la pantalla los calcula ella
   * misma, como antes. Con API manda la API: usa la misma fecha (UTC) que el
   * resto del sistema y no la del navegador.
   */
  expiringSoon?: boolean
  /** Hallazgos abiertos que cubre si está activa, o cubriría si se aprueba. */
  affectedFindings?: number
  revokedBy?: string
  revocationReason?: string
}

export type NewExceptionInput = {
  control: string
  resource: string
  environment: Environment
  justification: string
  expiresOn: string
  approver: string
  remediationPlan: string
}

export type ExceptionStat = {
  label: string
  value: number
  tone: Tone
}
