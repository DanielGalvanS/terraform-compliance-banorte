import {
  autonomyRules,
  cycleSteps,
  decisions,
  permissions,
  status,
} from '../data/agent.fixture'
import type {
  AgentDecision,
  AgentStatus,
  AutonomyRule,
  CycleStep,
  Permission,
} from '../model'

export const agentRepository = {
  getStatus: (): AgentStatus => status,
  getCycleSteps: (): CycleStep[] => cycleSteps,
  getDecisions: (): AgentDecision[] => decisions,
  getAutonomyRules: (): AutonomyRule[] => autonomyRules,
  getPermissions: (): Permission[] => permissions,
}
