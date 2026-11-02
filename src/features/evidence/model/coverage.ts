import type { EvidenceCoverage } from './types'

/** Radius of the coverage ring in the SVG's own units. */
export const RING_RADIUS = 40

const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function totalEvidence(coverage: EvidenceCoverage): number {
  return coverage.completed + coverage.pending + coverage.invalid
}

export function coveragePercent(coverage: EvidenceCoverage): number {
  const total = totalEvidence(coverage)
  return total === 0 ? 0 : (coverage.completed / total) * 100
}

/** Dash pattern that fills the ring in proportion to the covered share. */
export function ringDashArray(coverage: EvidenceCoverage): string {
  const filled = (coveragePercent(coverage) / 100) * CIRCUMFERENCE
  return `${filled.toFixed(1)} ${(CIRCUMFERENCE - filled).toFixed(1)}`
}
