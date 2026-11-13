import { Badge, Card, CardHeader, Icon } from '@/shared/ui'
import type { AutonomyRule } from '../model'

export function AutonomyCard({ rules }: { rules: AutonomyRule[] }) {
  return (
    <Card>
      <CardHeader
        title="Niveles de autonomía"
        subtitle="Configuración de solo lectura"
        aside={<Icon name="lock" />}
      />
      <table className="autonomy-table">
        <thead>
          <tr>
            <th>Ambiente</th>
            <th>Baja / Media</th>
            <th>Alta / Crítica</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.environment}>
              <td>
                <Badge tone={rule.tone}>{rule.environment}</Badge>
              </td>
              <td>{rule.lowAndMedium}</td>
              <td>{rule.highAndCritical}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
