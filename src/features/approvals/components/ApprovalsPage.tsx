import { useState } from 'react'
import { HumanOversightBanner, PageTitle } from '@/shared/ui'
import { approvalsRepository } from '../api/approvalsRepository'
import type { Decision } from '../model'
import { ApprovalCard } from './ApprovalCard'

export function ApprovalsPage() {
  const requests = approvalsRepository.getPendingRequests()
  const [comments, setComments] = useState<Record<number, string>>({})
  const [decisions, setDecisions] = useState<Record<number, Decision>>({})

  return (
    <>
      <PageTitle
        eyebrow="CONTROL HUMANO"
        title="Aprobaciones pendientes"
        description="Cambios sensibles que requieren decisión explícita antes de producción."
      />
      <HumanOversightBanner
        title="El agente nunca aplica cambios en producción sin tu aprobación"
        description="Cada decisión queda firmada y registrada en el log inmutable de evidencias."
      />
      <div className="approval-list">
        {requests.map((request) => (
          <ApprovalCard
            key={request.id}
            request={request}
            comment={comments[request.id] ?? ''}
            decision={decisions[request.id]}
            onCommentChange={(comment) =>
              setComments((current) => ({ ...current, [request.id]: comment }))
            }
            onDecide={(decision) =>
              setDecisions((current) => ({ ...current, [request.id]: decision }))
            }
          />
        ))}
      </div>
    </>
  )
}
