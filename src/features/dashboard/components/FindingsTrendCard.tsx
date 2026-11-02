import { Badge, Card, CardHeader } from '@/shared/ui'
import type { FindingsTrend } from '../model'

/** Pixels of bar height per open finding. */
const PIXELS_PER_FINDING = 5

export function FindingsTrendCard({ trend }: { trend: FindingsTrend }) {
  return (
    <Card className="trend-card">
      <CardHeader
        title="Tendencia de hallazgos"
        subtitle="Últimos 30 días"
        aside={<Badge tone="success">{trend.changeLabel}</Badge>}
      />
      <div className="trend-number">
        <strong>{trend.openToday}</strong>
        <span>abiertos hoy</span>
      </div>
      <div className="spark">
        {trend.points.map((value, index) => (
          <div key={index} className="spark-col">
            <span style={{ height: `${value * PIXELS_PER_FINDING}px` }} />
            <small>{trend.labels[index] ?? ''}</small>
          </div>
        ))}
      </div>
    </Card>
  )
}
