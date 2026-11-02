import { approvalRequests } from '../data/approvals.fixture'
import type { ApprovalRequest } from '../model'

export const approvalsRepository = {
  getPendingRequests: (): ApprovalRequest[] => approvalRequests,
}
