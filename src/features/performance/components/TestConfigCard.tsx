import { Button, Card, CardHeader, Icon } from '@/shared/ui'
import type { TestRunConfig } from '../model'

type TestConfigCardProps = {
  config: TestRunConfig
  isRunning: boolean
  onRun: () => void
}

export function TestConfigCard({ config, isRunning, onRun }: TestConfigCardProps) {
  return (
    <Card className="test-config">
      <CardHeader title="Nueva ejecución" subtitle="Configura el alcance de la prueba" />
      <label>
        Ambiente
        <select>
          {config.environments.map((environment) => (
            <option key={environment}>{environment}</option>
          ))}
        </select>
      </label>
      <label>
        Duración
        <select>
          {config.durations.map((duration) => (
            <option key={duration}>{duration}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Pruebas incluidas</legend>
        {config.tests.map((test) => (
          <label key={test.id}>
            <input type="checkbox" defaultChecked />
            <span>
              <Icon name="check" size={12} />
            </span>
            {test.label}
          </label>
        ))}
      </fieldset>
      <Button icon="play" onClick={onRun} disabled={isRunning}>
        {isRunning ? 'Ejecutando pruebas…' : 'Lanzar prueba'}
      </Button>
      <small className="test-cost">{config.estimatedCostLabel}</small>
    </Card>
  )
}
