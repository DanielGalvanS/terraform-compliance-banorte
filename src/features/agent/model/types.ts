import type { Environment, Tone } from '@/shared/model'

/** Who owns each step of the decision cycle. */
export type StepOwner = 'deterministic' | 'ai' | 'human'

export type CycleStep = {
  name: string
  owner: StepOwner
}

export type AgentDecision = {
  id: string
  timeLabel: string
  title: string
  /** Signals and engines the decision was based on. */
  tools: string
  rationale: string
  outcomeLabel: string
  outcomeTone: Tone
}

export type AutonomyRule = {
  environment: Environment
  tone: Tone
  /** What the agent may do for low and medium severity findings. */
  lowAndMedium: string
  /** What it may do for high and critical ones. */
  highAndCritical: string
}

export type Permission = {
  text: string
  granted: boolean
}

export type AgentStatus = {
  version: string
  label: string
}
