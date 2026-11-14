import { Button, Card, Icon } from '@/shared/ui'
import type { Verdict } from '../model'

type VerdictCardProps = {
  verdict: Verdict
  /** Remediation branch opened from the verdict, when the agent proposed one. */
  remediationPr?: number
}

export function VerdictCard({ verdict, remediationPr }: VerdictCardProps) {
  return (
    <Card className="verdict">
      <div className="verdict-icon">
        <Icon name="shield" size={24} />
      </div>
      <div className="verdict-body">
        <span className="eyebrow">VEREDICTO DETERMINISTA</span>
        <h2>{verdict.title}</h2>
        <p>
          {verdict.summary} Esto viola{' '}
          {verdict.violatedControls.map((control, index) => (
            <span key={control}>
              {index > 0 && ' y '}
              <strong>{control}</strong>
            </span>
          ))}
          . El agente recomienda: {verdict.recommendation}
        </p>
        <div className="verdict-actions">
          {remediationPr && <Button icon="branch">Ver PR de remediación #{remediationPr}</Button>}
          <Button variant="secondary">Consultar evidencia</Button>
        </div>
      </div>
      <div className="confidence">
        <small>CONFIANZA IA</small>
        <strong>{verdict.confidencePercent}%</strong>
        <span>{verdict.engine}</span>
      </div>
    </Card>
  )
}
