import { Badge, Card, CardHeader } from '@/shared/ui'
import type { AgentDecision } from '../model'

export function DecisionTimeline({ decisions }: { decisions: AgentDecision[] }) {
  return (
    <Card className="decision-timeline">
      <CardHeader title="Decisiones recientes" subtitle="Trazabilidad del razonamiento" />
      {decisions.map((decision, index) => (
        <div className="timeline-item" key={decision.id}>
          <div className="timeline-marker">
            <span />
            {index < decisions.length - 1 && <i />}
          </div>
          <time>{decision.timeLabel}</time>
          <div>
            <strong>{decision.title}</strong>
            <small>Herramientas: {decision.tools}</small>
            <p>{decision.rationale}</p>
          </div>
          <Badge tone={decision.outcomeTone}>{decision.outcomeLabel}</Badge>
        </div>
      ))}
    </Card>
  )
}
