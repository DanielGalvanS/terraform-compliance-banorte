import { pullRequests } from '../data/pullRequests.fixture'
import type { PullRequest } from '../model'

export const pipelineRepository = {
  getPullRequests: (): PullRequest[] => pullRequests,

  getPullRequest: (id: number): PullRequest | undefined =>
    pullRequests.find((pullRequest) => pullRequest.id === id),
}
