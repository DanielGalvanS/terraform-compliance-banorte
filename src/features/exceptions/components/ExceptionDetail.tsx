import { Badge, DetailGrid, DetailSection, Icon } from '@/shared/ui'
import { environmentTone, severityTone } from '@/shared/model'
import { formatDate } from '../model/expiry'
import type { ComplianceException } from '../model'

/** The lifecycle of a waiver: requested, decided, then expired or revoked. */
function Timeline({ exception }: { exception: ComplianceException }) {
  const isDecided = exception.state !== 'Pendiente'
  const decisionLabel = exception.state === 'Rechazada' ? 'Rechazada' : 'Aprobada'

  return (
    <div className="exception-timeline">
      <div>
        <i className="done" />
        <span>
          <strong>Solicitada</strong>
          <small>
            {exception.requestedAtLabel} · {exception.requestedBy}
          </small>
        </span>
      </div>
      <div>
        <i className={isDecided ? 'done' : undefined} />
        <span>
          <strong>{decisionLabel}</strong>
          <small>{isDecided ? exception.approver : 'Pendiente de decisión'}</small>
        </span>
      </div>
      <div>
        <i />
        <span>
          <strong>Vencimiento o revocación</strong>
          <small>{formatDate(exception.expiresOn)}</small>
        </span>
      </div>
    </div>
  )
}

export function ExceptionDetail({ exception }: { exception: ComplianceException }) {
  return (
    <div className="drawer-body">
      <DetailGrid
        items={[
          { label: 'CONTROL', value: <strong>{exception.controlCode}</strong> },
          { label: 'MARCO', value: <strong>{exception.framework}</strong> },
          { label: 'RECURSO AFECTADO', value: <code>{exception.resource}</code> },
          {
            label: 'AMBIENTE',
            value: (
              <Badge tone={environmentTone(exception.environment)}>{exception.environment}</Badge>
            ),
          },
          {
            label: 'SEVERIDAD',
            value: <Badge tone={severityTone(exception.severity)}>{exception.severity}</Badge>,
          },
          { label: 'VIGENCIA HASTA', value: <strong>{formatDate(exception.expiresOn)}</strong> },
          { label: 'APROBADOR', value: <strong>{exception.approver}</strong> },
          {
            label: 'SOLICITÓ',
            value: <strong>{exception.requestedBy}</strong>,
            hint: exception.requestedAtLabel,
          },
        ]}
      />
      <DetailSection title="Justificación">
        <p className="detail-copy">{exception.justification}</p>
      </DetailSection>
      {exception.remediationPlan && (
        <DetailSection title="Plan de remediación">
          <button type="button" className="table-action">
            <Icon name="external" size={13} /> {exception.remediationPlan}
          </button>
        </DetailSection>
      )}
      <DetailSection title="Evidencia registrada">
        <button type="button" className="table-action">
          <Icon name="evidence" size={13} /> evidencia-{exception.id.toLowerCase()}.pdf
        </button>
      </DetailSection>
      <DetailSection title="Línea de tiempo">
        <Timeline exception={exception} />
      </DetailSection>
    </div>
  )
}
