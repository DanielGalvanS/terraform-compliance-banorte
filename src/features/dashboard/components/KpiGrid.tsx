import { Card, Icon } from '@/shared/ui'
import type { Kpi } from '../model'

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="kpi-grid">
      {kpis.map((kpi) => (
        <Card key={kpi.id} className={`kpi ${kpi.featured ? 'featured' : ''}`.trim()}>
          <div className="kpi-top">
            <span>{kpi.label}</span>
            <Icon name={kpi.icon} />
          </div>
          <strong>
            {kpi.value}
            {kpi.unit && <em>{kpi.unit}</em>}
          </strong>
          {kpi.severityBreakdown && (
            <div className="severity-row">
              <i className="critical">{kpi.severityBreakdown.critical}</i>
              <i className="high">{kpi.severityBreakdown.high}</i>
              <i className="medium">{kpi.severityBreakdown.medium}</i>
            </div>
          )}
          {kpi.footnote && (
            <small>
              {kpi.footnote.map((segment, index) =>
                segment.emphasis ? (
                  <b key={index}>{segment.text}</b>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
            </small>
          )}
        </Card>
      ))}
    </div>
  )
}
