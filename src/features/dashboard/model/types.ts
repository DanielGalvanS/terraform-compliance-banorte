import type { IconName } from '@/shared/ui'
import type { Tone } from '@/shared/model'

/** A run of text in a KPI footnote; `emphasis` renders it bold. */
export type FootnoteSegment = {
  text: string
  emphasis?: boolean
}

export type Kpi = {
  id: string
  label: string
  icon: IconName
  value: string
  /** Rendered smaller next to the value, e.g. "min" or "h". */
  unit?: string
  /** Highlights the primary metric of the page. */
  featured?: boolean
  footnote?: FootnoteSegment[]
  /** Replaces the footnote with a critical / high / medium count row. */
  severityBreakdown?: { critical: number; high: number; medium: number }
}

export type FrameworkScore = {
  framework: string
  /** Percentage of controls currently covered. */
  score: number
}

export type FindingsTrend = {
  /** One value per day, oldest first. */
  points: number[]
  /** Labels keyed by index, so only milestone days are annotated. */
  labels: Record<number, string>
  openToday: number
  changeLabel: string
}

export type AgentActivity = {
  id: string
  icon: IconName
  tone: Tone
  text: string
  meta: string
}

export type CostSummary = {
  scope: string
  spentLabel: string
  budgetLabel: string
  /** Share of the budget consumed, 0–100. */
  usedPercent: number
  projectionLabel: string
}

export type PostureSummary = {
  headline: string
  lastAssessment: string
  badge: string
}
