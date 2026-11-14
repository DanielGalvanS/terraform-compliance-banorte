import { Card, CardHeader, FuenteDeDatos, type Fuente } from '@/shared/ui'
import type { FrameworkScore } from '../model'

/** Below this coverage a framework is drawn as a warning instead of on-track. */
const WARNING_THRESHOLD = 90

type FrameworkChartProps = {
  scores: FrameworkScore[]
  fuente: Fuente
}

export function FrameworkChart({ scores, fuente }: FrameworkChartProps) {
  return (
    <Card className="chart-card">
      <CardHeader
        title="Cumplimiento por marco"
        subtitle={
          fuente === 'api'
            ? 'Controles sin hallazgos abiertos, sobre el total de cada marco'
            : 'Cobertura de controles activos'
        }
        aside={<FuenteDeDatos fuente={fuente} />}
      />
      <div className="framework-chart">
        {scores.map((item) => (
          <div className="framework-row" key={item.framework}>
            <span>{item.framework}</span>
            <div className="bar-track">
              <div
                className={`bar-fill ${item.score < WARNING_THRESHOLD ? 'warn' : ''}`.trim()}
                style={{ width: `${item.score}%` }}
              />
            </div>
            <strong>{item.score}%</strong>
          </div>
        ))}
      </div>
    </Card>
  )
}
