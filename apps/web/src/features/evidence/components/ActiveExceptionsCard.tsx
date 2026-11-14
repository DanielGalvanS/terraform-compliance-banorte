import { Badge, Card, CardHeader } from '@/shared/ui'
import { formatDate, type ComplianceException } from '@/features/exceptions'
import { isExpiryUrgent } from '@/features/exceptions/model/expiry'

/**
 * Exceptions in force, read from the exceptions feature so the audit view and
 * the register can never drift apart.
 */
export function ActiveExceptionsCard({ exceptions }: { exceptions: ComplianceException[] }) {
  return (
    <Card className="exceptions">
      <CardHeader
        title="Excepciones vigentes"
        subtitle="Controles aceptados temporalmente"
        aside={<Badge tone="warning">{exceptions.length} activas</Badge>}
      />
      <div className="exception-grid">
        {exceptions.map((exception) => {
          const urgent = isExpiryUrgent(exception.expiresOn)
          return (
            <div className="exception" key={exception.id}>
              <div>
                <code>{exception.id}</code>
                <Badge tone={urgent ? 'critical' : 'warning'}>
                  {urgent ? 'Vence pronto' : 'Vigente'}
                </Badge>
              </div>
              <strong>{exception.justification}</strong>
              <span>{exception.controlCode}</span>
              <dl>
                <dt>Aprobó</dt>
                <dd>{exception.approver}</dd>
                <dt>Vencimiento</dt>
                <dd>{formatDate(exception.expiresOn)}</dd>
              </dl>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
