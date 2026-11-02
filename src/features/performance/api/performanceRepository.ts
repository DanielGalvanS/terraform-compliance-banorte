import { destroyTarget, latestRun, runConfig } from '../data/performance.fixture'
import type { DestroyTarget, TestRun, TestRunConfig } from '../model'

export const performanceRepository = {
  getRunConfig: (): TestRunConfig => runConfig,
  getLatestRun: (): TestRun => latestRun,
  getDestroyTarget: (): DestroyTarget => destroyTarget,
}
