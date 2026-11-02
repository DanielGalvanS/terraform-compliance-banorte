import { Badge, Card, CardHeader, Icon } from '@/shared/ui'
import type { PipelineRun, PipelineStep } from '../model'

type RunStepperProps = {
  run: PipelineRun
  openStep: string | null
  onToggleStep: (name: string) => void
}

/** Numbered marker for steps that have not run, a tick or an alert otherwise. */
function stepMarker(step: PipelineStep, index: number) {
  if (step.status === 'ok') return <Icon name="check" size={14} />
  if (step.status === 'pending') return index + 1
  return '!'
}

export function RunStepper({ run, openStep, onToggleStep }: RunStepperProps) {
  return (
    <Card className="stepper-card">
      <CardHeader
        title={run.id}
        subtitle={run.startedLabel}
        aside={<Badge tone={run.stateTone}>{run.stateLabel}</Badge>}
      />
      <div className="stepper">
        {run.steps.map((step, index) => (
          <div className={`step ${step.status}`} key={step.name}>
            <div className="step-line">
              <span>{stepMarker(step, index)}</span>
            </div>
            <strong>{step.name}</strong>
            <small>{step.duration}</small>
          </div>
        ))}
      </div>
      <div className="logs">
        {run.steps.map((step) => (
          <div className="log-row" key={step.name}>
            <button type="button" onClick={() => onToggleStep(step.name)}>
              <span className={`status-ring ${step.status}`} /> <strong>{step.name}</strong>
              <small>{step.duration}</small>
              <Icon name="chevron" size={15} />
            </button>
            {openStep === step.name && <pre>{step.log}</pre>}
          </div>
        ))}
      </div>
    </Card>
  )
}
