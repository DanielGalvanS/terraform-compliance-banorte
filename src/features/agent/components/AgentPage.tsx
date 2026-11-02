import { Badge, PageTitle } from '@/shared/ui'
import { agentRepository } from '../api/agentRepository'
import { AutonomyCard } from './AutonomyCard'
import { DecisionCycleCard } from './DecisionCycleCard'
import { DecisionTimeline } from './DecisionTimeline'
import { PermissionsCard } from './PermissionsCard'

export function AgentPage() {
  const status = agentRepository.getStatus()

  return (
    <>
      <PageTitle
        eyebrow="ORQUESTACIÓN INTELIGENTE"
        title="Agente de IA"
        description="Interpreta señales y propone acciones; las políticas deciden, las personas aprueban."
        action={
          <Badge tone="success">
            {status.label} · {status.version}
          </Badge>
        }
      />
      <DecisionCycleCard steps={agentRepository.getCycleSteps()} />
      <div className="agent-layout">
        <DecisionTimeline decisions={agentRepository.getDecisions()} />
        <div className="agent-side">
          <AutonomyCard rules={agentRepository.getAutonomyRules()} />
          <PermissionsCard permissions={agentRepository.getPermissions()} />
        </div>
      </div>
    </>
  )
}
