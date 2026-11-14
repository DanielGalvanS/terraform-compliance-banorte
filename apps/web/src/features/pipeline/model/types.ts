import type { Environment, Tone } from '@/shared/model'

export type StepStatus = 'ok' | 'warning' | 'blocked' | 'pending'

export type PipelineStep = {
  name: string
  status: StepStatus
  /** Human duration, or an em dash while the step has not run. */
  duration: string
  /** Log excerpt shown when the row is expanded. */
  log: string
}

export type PipelineRun = {
  id: string
  startedLabel: string
  stateLabel: string
  stateTone: Tone
  steps: PipelineStep[]
}

/** Deterministic policy decision that gates the deployment. */
export type Verdict = {
  title: string
  summary: string
  violatedControls: string[]
  recommendation: string
  confidencePercent: number
  engine: string
}

export type PullRequest = {
  id: number
  title: string
  description: string
  environment: Environment
  stateLabel: string
  tone: Tone
  author: string
  age: string
  commit: string
  run: PipelineRun
  /** Present only while a policy blocks the change. */
  verdict?: Verdict
}
