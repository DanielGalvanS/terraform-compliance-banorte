import { Button, Icon } from '@/shared/ui'
import type { ReportOptions } from '../model'

type ReportBuilderProps = {
  options: ReportOptions
  onGenerate: () => void
}

export function ReportBuilder({ options, onGenerate }: ReportBuilderProps) {
  return (
    <div className="report-builder">
      <div>
        <Icon name="evidence" />
        <span>
          <strong>Generar reporte de cumplimiento</strong>
          <small>Paquete firmado con evidencia y anexos</small>
        </span>
      </div>
      <label>
        Marco
        <select>
          {options.frameworks.map((framework) => (
            <option key={framework}>{framework}</option>
          ))}
        </select>
      </label>
      <label>
        Ambiente
        <select>
          {options.environments.map((environment) => (
            <option key={environment}>{environment}</option>
          ))}
        </select>
      </label>
      <label>
        Periodo
        <select>
          {options.periods.map((period) => (
            <option key={period}>{period}</option>
          ))}
        </select>
      </label>
      <Button variant="secondary" onClick={onGenerate}>
        Generar reporte
      </Button>
    </div>
  )
}
