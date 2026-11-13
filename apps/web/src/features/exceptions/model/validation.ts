import type { NewExceptionInput } from './types'

/** Shortest justification the compliance team accepts. */
export const MIN_JUSTIFICATION_LENGTH = 30

export type ValidationErrors = Partial<Record<keyof NewExceptionInput, string>>

type ValidationRange = {
  minDate: string
  maxDate: string
}

/**
 * Pure validation for a new exception request, so the rules can be tested and
 * reused (form, API) without touching the component.
 */
export function validateNewException(
  input: NewExceptionInput,
  { minDate, maxDate }: ValidationRange,
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!input.control) errors.control = 'Selecciona un hallazgo o control.'
  if (!input.resource) errors.resource = 'Selecciona el recurso afectado.'
  if (input.justification.trim().length < MIN_JUSTIFICATION_LENGTH) {
    errors.justification = `Escribe al menos ${MIN_JUSTIFICATION_LENGTH} caracteres.`
  }
  if (!input.expiresOn) {
    errors.expiresOn = 'Selecciona la fecha de vigencia.'
  } else if (input.expiresOn < minDate || input.expiresOn > maxDate) {
    errors.expiresOn = 'La fecha debe estar dentro de los próximos 90 días.'
  }
  if (!input.approver) errors.approver = 'Selecciona un aprobador.'

  return errors
}
