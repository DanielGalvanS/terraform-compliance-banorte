import { Card, CardHeader, Icon } from '@/shared/ui'
import type { CycleStep, StepOwner } from '../model'

/** `deterministic` is the default style, so it contributes no class. */
const OWNER_CLASS: Record<StepOwner, string> = {
  deterministic: '',
  ai: 'ai',
  human: 'human',
}

function CycleLegend() {
  return (
    <div className="legend">
      <span>
        <i className="det" />
        Determinista
      </span>
      <span>
        <i className="ai" />
        IA
      </span>
      <span>
        <i className="human" />
        Humano
      </span>
    </div>
  )
}

export function DecisionCycleCard({ steps }: { steps: CycleStep[] }) {
  return (
    <Card className="agent-cycle">
      <CardHeader
        title="Ciclo de decisión"
        subtitle="Flujo supervisado de cumplimiento continuo"
        aside={<CycleLegend />}
      />
      <div className="cycle-flow">
        {steps.map((step, index) => (
          <div key={step.name} className={`cycle-node ${OWNER_CLASS[step.owner]}`.trim()}>
            <span>{index + 1}</span>
            <strong>{step.name}</strong>
            {index < steps.length - 1 && <Icon name="arrow" />}
          </div>
        ))}
      </div>
    </Card>
  )
}
