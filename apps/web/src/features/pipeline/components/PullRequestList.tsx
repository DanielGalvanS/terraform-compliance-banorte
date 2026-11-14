import { Badge, Card, CardHeader, Icon, IconButton } from '@/shared/ui'
import type { PullRequest } from '../model'

type PullRequestListProps = {
  pullRequests: PullRequest[]
  selectedId: number
  onSelect: (id: number) => void
}

export function PullRequestList({ pullRequests, selectedId, onSelect }: PullRequestListProps) {
  return (
    <Card className="pr-list">
      <CardHeader
        title="Pull requests"
        subtitle={`${pullRequests.length} activas`}
        compact
        aside={<IconButton icon="filter" label="Filtrar pull requests" />}
      />
      {pullRequests.map((pullRequest) => (
        <button
          key={pullRequest.id}
          type="button"
          className={`pr-item ${selectedId === pullRequest.id ? 'active' : ''}`.trim()}
          onClick={() => onSelect(pullRequest.id)}
        >
          <div className="pr-id">
            <Icon name="branch" size={15} />#{pullRequest.id}
            <Badge tone={pullRequest.tone}>{pullRequest.environment}</Badge>
          </div>
          <strong>{pullRequest.title}</strong>
          <small>
            {pullRequest.author} · {pullRequest.age}
          </small>
          <Badge tone={pullRequest.tone}>{pullRequest.stateLabel}</Badge>
        </button>
      ))}
    </Card>
  )
}
