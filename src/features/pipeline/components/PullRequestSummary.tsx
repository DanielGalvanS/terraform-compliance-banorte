import { Badge, Card, Icon } from '@/shared/ui'
import { environmentTone } from '@/shared/model'
import type { PullRequest } from '../model'

export function PullRequestSummary({ pullRequest }: { pullRequest: PullRequest }) {
  return (
    <Card className="pr-summary">
      <div>
        <div className="pr-id">
          <Icon name="branch" />
          PR #{pullRequest.id}{' '}
          <Badge tone={environmentTone(pullRequest.environment)}>{pullRequest.environment}</Badge>
        </div>
        <h2>{pullRequest.title}</h2>
        <p>{pullRequest.description}</p>
      </div>
      <div className="commit-box">
        <small>COMMIT</small>
        <code>{pullRequest.commit}</code>
      </div>
    </Card>
  )
}
