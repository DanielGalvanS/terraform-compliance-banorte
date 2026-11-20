import type { ExcepcionApi } from '@/shared/api'
import type { ComplianceException } from '../model'

/** Traduce una excepción de la API al modelo de la pantalla. */
export function desdeApi(excepcion: ExcepcionApi): ComplianceException {
  return {
    id: excepcion.codigo,
    controlCode: excepcion.control,
    controlName: excepcion.controlNombre,
    framework: excepcion.marco,
    resource: excepcion.recurso,
    environment: excepcion.ambiente,
    severity: excepcion.severidad,
    justification: excepcion.justificacion,
    // Mientras nadie decide, se muestra a quién se le pidió la aprobación.
    approver: excepcion.aprobadaPor ?? excepcion.aprobadorSolicitado,
    requestedBy: excepcion.solicitadaPor,
    requestedAtLabel: new Date(excepcion.solicitadaEn).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    expiresOn: excepcion.venceEl,
    state: excepcion.estado,
    ...(excepcion.planRemediacion === null
      ? {}
      : { remediationPlan: excepcion.planRemediacion }),
    expiringSoon: excepcion.porVencer,
    affectedFindings: excepcion.hallazgosAfectados,
    ...(excepcion.revocadaPor === null ? {} : { revokedBy: excepcion.revocadaPor }),
    ...(excepcion.motivoRevocacion === null
      ? {}
      : { revocationReason: excepcion.motivoRevocacion }),
  }
}
