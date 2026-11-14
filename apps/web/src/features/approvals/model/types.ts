import type { Environment, Severity } from '@/shared/model'

export type ApprovalRequest = {
  id: number
  severity: Severity
  environment: Environment
  title: string
  resource: string
  /** What applying the change implies operationally. */
  risk: string
  /** Why the agent is proposing it. */
  rationale: string
  requestedAgoLabel: string
  expiresInLabel: string
  /** Where the request was broadcast; hoy solo Slack. */
  channels: string
}

export type Decision = 'Aprobada' | 'Rechazada'
