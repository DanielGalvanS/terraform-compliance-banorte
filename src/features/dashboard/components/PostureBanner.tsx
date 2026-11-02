import { Badge } from '@/shared/ui'
import type { PostureSummary } from '../model'

export function PostureBanner({ posture }: { posture: PostureSummary }) {
  return (
    <div className="status-banner">
      <span className="pulse" />
      <strong>{posture.headline}</strong>
      <span>{posture.lastAssessment}</span>
      <Badge tone="success">{posture.badge}</Badge>
    </div>
  )
}
