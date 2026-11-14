import { Button, Card, CardHeader, Icon } from '@/shared/ui'
import type { CostSummary } from '../model'

type CostCardProps = {
  cost: CostSummary
  onSeeBreakdown: () => void
}

export function CostCard({ cost, onSeeBreakdown }: CostCardProps) {
  return (
    <Card className="cost-card">
      <CardHeader title="Costo estimado" subtitle={cost.scope} aside={<Icon name="cloud" />} />
      <div className="cost-value">
        <strong>{cost.spentLabel}</strong>
        <span>{cost.budgetLabel}</span>
      </div>
      <div className="budget-track">
        <span style={{ width: `${cost.usedPercent}%` }} />
      </div>
      <div className="budget-alert">
        <Icon name="findings" size={16} />
        <span>
          <strong>
            {cost.usedPercent.toLocaleString('es-MX', { maximumFractionDigits: 1 })}% del
            presupuesto
          </strong>
          <small>{cost.projectionLabel}</small>
        </span>
      </div>
      <Button variant="secondary" onClick={onSeeBreakdown}>
        Ver desglose de recursos
      </Button>
    </Card>
  )
}
