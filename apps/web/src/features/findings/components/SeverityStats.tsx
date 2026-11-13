import { severityTone } from '@/shared/model'
import type { FindingsSummary } from '../model'

export function SeverityStats({ summary }: { summary: FindingsSummary }) {
  return (
    <div className="finding-stats">
      {summary.counts.map((entry) => (
        <span key={entry.severity}>
          <i className={severityTone(entry.severity)} />
          {entry.count} {entry.severity}
        </span>
      ))}
      <small>{summary.totalLabel}</small>
    </div>
  )
}
