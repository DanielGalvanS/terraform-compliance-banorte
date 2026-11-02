import {
  agentActivity,
  costSummary,
  findingsTrend,
  frameworkScores,
  kpis,
  posture,
} from '../data/dashboard.fixture'
import type {
  AgentActivity,
  CostSummary,
  FindingsTrend,
  FrameworkScore,
  Kpi,
  PostureSummary,
} from '../model'

/**
 * Read model for the overview page. Each accessor is the seam where a real
 * backend call replaces the fixture; the components never import fixtures.
 */
export const dashboardRepository = {
  getPosture: (): PostureSummary => posture,
  getKpis: (): Kpi[] => kpis,
  getFrameworkScores: (): FrameworkScore[] => frameworkScores,
  getFindingsTrend: (): FindingsTrend => findingsTrend,
  getAgentActivity: (): AgentActivity[] => agentActivity,
  getCostSummary: (): CostSummary => costSummary,
}
