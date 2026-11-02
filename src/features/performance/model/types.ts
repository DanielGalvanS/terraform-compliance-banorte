export type TestOption = {
  id: string
  label: string
}

export type PerformanceMetric = {
  name: string
  value: string
  targetLabel: string
  /** How close the result sits to its target, 0–100. */
  achievedPercent: number
}

export type MetricComparison = {
  name: string
  currentPercent: number
  previousPercent: number
}

export type TestRun = {
  id: string
  contextLabel: string
  metrics: PerformanceMetric[]
  comparisons: MetricComparison[]
}

export type TestRunConfig = {
  environments: string[]
  durations: string[]
  tests: TestOption[]
  estimatedCostLabel: string
}

export type DestroyTarget = {
  environmentName: string
  resourceCount: number
  accumulatedCostLabel: string
  /** Word the operator must type to unlock the destructive action. */
  confirmationWord: string
}
