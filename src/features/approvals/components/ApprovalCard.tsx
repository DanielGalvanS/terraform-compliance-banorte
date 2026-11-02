import { Badge, Button, Card, Icon } from '@/shared/ui'
import { severityTone } from '@/shared/model'
import type { ApprovalRequest, Decision } from '../model'

type ApprovalCardProps = {
  request: ApprovalRequest
  comment: string
  decision?: Decision
  onCommentChange: (comment: string) => void
  onDecide: (decision: Decision) => void
}

export function ApprovalCard({
  request,
  comment,
  decision,
  onCommentChange,
  onDecide,
}: ApprovalCardProps) {
  // A decision is only valid with a written rationale; it is part of the record.
  const canDecide = comment.trim().length > 0

  return (
    <Card className="approval-card">
      <div className="approval-side">
        <Badge tone={severityTone(request.severity)}>{request.severity}</Badge>
        <span className="env-prod">{request.environment.toUpperCase()}</span>
        <small>SOLICITUD</small>
        <code>APR-{request.id}</code>
      </div>
      <div className="approval-content">
        <div className="approval-title">
          <div>
            <h2>{request.title}</h2>
            <code>{request.resource}</code>
          </div>
          <span className="sent-label">{request.channels}</span>
        </div>
        <div className="approval-info">
          <div>
            <small>RIESGO DEL CAMBIO</small>
            <p>{request.risk}</p>
          </div>
          <div>
            <small>JUSTIFICACIÓN DEL AGENTE</small>
            <p>{request.rationale}</p>
          </div>
        </div>
        {decision ? (
          <div className={`decision-complete ${decision === 'Aprobada' ? 'approved' : ''}`.trim()}>
            <Icon name={decision === 'Aprobada' ? 'check' : 'close'} />
            <div>
              <strong>Solicitud {decision.toLowerCase()}</strong>
              <p>Decisión registrada con comentario y firma digital.</p>
            </div>
          </div>
        ) : (
          <>
            <label className="comment-label">
              Comentario obligatorio
              <textarea
                placeholder="Escribe el fundamento de tu decisión…"
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
              />
            </label>
            <div className="approval-actions">
              <small>
                Solicitada {request.requestedAgoLabel} · {request.expiresInLabel}
              </small>
              <Button
                variant="danger"
                disabled={!canDecide}
                onClick={() => onDecide('Rechazada')}
              >
                Rechazar
              </Button>
              <Button disabled={!canDecide} onClick={() => onDecide('Aprobada')} icon="check">
                Aprobar cambio
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
