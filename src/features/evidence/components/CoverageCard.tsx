import { Card, CardHeader } from '@/shared/ui'
import { coveragePercent, ringDashArray, RING_RADIUS, totalEvidence } from '../model/coverage'
import type { EvidenceCoverage } from '../model'

export function CoverageCard({ coverage }: { coverage: EvidenceCoverage }) {
  const percent = coveragePercent(coverage)
  const total = totalEvidence(coverage)

  return (
    <Card className="report-status">
      <CardHeader title="Cobertura de evidencia" subtitle={coverage.periodLabel} />
      <div className="coverage-ring">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={RING_RADIUS} />
          <circle
            className="progress"
            cx="50"
            cy="50"
            r={RING_RADIUS}
            strokeDasharray={ringDashArray(coverage)}
          />
        </svg>
        <div>
          <strong>{percent.toFixed(1)}%</strong>
          <small>
            {coverage.completed.toLocaleString('es-MX')} / {total.toLocaleString('es-MX')}
          </small>
        </div>
      </div>
      <div className="coverage-list">
        <span>
          <i className="green" />
          Completas <strong>{coverage.completed.toLocaleString('es-MX')}</strong>
        </span>
        <span>
          <i className="yellow" />
          Pendientes <strong>{coverage.pending}</strong>
        </span>
        <span>
          <i className="red" />
          Inválidas <strong>{coverage.invalid}</strong>
        </span>
      </div>
    </Card>
  )
}
