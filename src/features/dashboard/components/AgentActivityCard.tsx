import { Card, CardHeader, Icon, LinkButton } from '@/shared/ui'
import type { AgentActivity } from '../model'

type AgentActivityCardProps = {
  activity: AgentActivity[]
  onSeeAll: () => void
}

export function AgentActivityCard({ activity, onSeeAll }: AgentActivityCardProps) {
  return (
    <Card className="activity-card">
      <CardHeader
        title="Actividad reciente del agente"
        subtitle="Decisiones y acciones autónomas"
        aside={<LinkButton onClick={onSeeAll}>Ver todo</LinkButton>}
      />
      <div className="activity-list">
        {activity.map((item) => (
          <div className="activity" key={item.id}>
            <span className={`activity-icon ${item.tone}`}>
              <Icon name={item.icon} size={16} />
            </span>
            <div>
              <strong>{item.text}</strong>
              <small>{item.meta}</small>
            </div>
            <span className="activity-arrow">
              <Icon name="chevron" size={16} />
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
