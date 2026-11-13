import { Badge, Card, CardHeader } from '@/shared/ui'
import type { TestRun } from '../model'

/** Bar width shown while a run is in flight and no value exists yet. */
const RUNNING_BAR_WIDTH = '12%'

type RunResultsCardProps = {
  run: TestRun
  isRunning: boolean
}

export function RunResultsCard({ run, isRunning }: RunResultsCardProps) {
  return (
    <Card className="results-card">
      <CardHeader
        title={`Resultados · ${run.id}`}
        subtitle={run.contextLabel}
        aside={
          <Badge tone={isRunning ? 'warning' : 'success'}>
            {isRunning ? 'En ejecución' : 'Todas conformes'}
          </Badge>
        }
      />
      {isRunning && (
        <div className="run-progress">
          <span />
          <p>Ejecutando pruebas de rendimiento…</p>
        </div>
      )}
      <div className="metric-grid">
        {run.metrics.map((metric) => (
          <div className="metric-result" key={metric.name}>
            <span>{metric.name}</span>
            <strong>{isRunning ? '—' : metric.value}</strong>
            <small>Objetivo {metric.targetLabel}</small>
            <div>
              <i
                style={{
                  width: isRunning ? RUNNING_BAR_WIDTH : `${metric.achievedPercent}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="comparison">
        <div className="comparison-head">
          <strong>Comparación entre ejecuciones</strong>
          <span>
            <i className="current" />
            Actual
          </span>
          <span>
            <i className="previous" />
            Anterior
          </span>
        </div>
        {run.comparisons.map((comparison) => (
          <div className="compare-row" key={comparison.name}>
            <span>{comparison.name}</span>
            <div>
              <i className="previous" style={{ width: `${comparison.previousPercent}%` }} />
              <i className="current" style={{ width: `${comparison.currentPercent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
