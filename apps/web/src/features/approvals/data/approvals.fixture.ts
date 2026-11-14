import type { ApprovalRequest } from '../model'

export const approvalRequests: ApprovalRequest[] = [
  {
    id: 881,
    severity: 'Crítica',
    environment: 'Prod',
    title: 'Restringir SSH a rango corporativo',
    resource: 'fw-allow-ssh',
    risk: 'Reduce exposición pública. Cambio reversible, sin downtime.',
    rationale:
      'Remediación directa de CIS GCP 3.6. Validada en QA y propuesta por PR #143.',
    requestedAgoLabel: 'hace 12 min',
    expiresInLabel: 'vence en 3 h',
    channels: 'Enviada por Slack',
  },
  {
    id: 879,
    severity: 'Alta',
    environment: 'Prod',
    title: 'Rotar clave CMEK de Cloud SQL',
    resource: 'sql-mdc-prod-01',
    risk: 'Reinicio esperado de 2 minutos durante ventana autorizada.',
    rationale:
      'La clave supera el periodo de rotación de 90 días definido en PCI DSS 3.5.',
    requestedAgoLabel: 'hace 47 min',
    expiresInLabel: 'vence en 3 h',
    channels: 'Enviada por Slack',
  },
]
