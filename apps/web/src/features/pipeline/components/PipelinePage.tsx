import { useMemo, useState } from 'react'
import { Button, PageTitle } from '@/shared/ui'
import { pipelineRepository } from '../api/pipelineRepository'
import { PipelinePageEmpty } from './PipelinePageEmpty'
import { PullRequestList } from './PullRequestList'
import { PullRequestSummary } from './PullRequestSummary'
import { RunStepper } from './RunStepper'
import { VerdictCard } from './VerdictCard'

/** Remediation branch the agent opens for the blocked change. */
const REMEDIATION_PR = 143

export function PipelinePage() {
  const pullRequests = pipelineRepository.getPullRequests()
  const [selectedId, setSelectedId] = useState(() => pullRequests[0]?.id ?? 0)
  const [openStep, setOpenStep] = useState<string | null>('Políticas')

  const selected = useMemo(
    () => pullRequests.find((pullRequest) => pullRequest.id === selectedId),
    [pullRequests, selectedId],
  )

  return (
    <>
      <PageTitle
        eyebrow="CI/CD · INFRAESTRUCTURA"
        title="Pipeline de despliegue"
        description="Validación determinista y supervisión del agente antes de cada cambio."
        action={
          <Button variant="secondary" icon="external">
            Abrir en GitHub
          </Button>
        }
      />
      <div className="pipeline-layout">
        <PullRequestList
          pullRequests={pullRequests}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div className="pipeline-main">
          {selected ? (
            <>
              <PullRequestSummary pullRequest={selected} />
              <RunStepper
                run={selected.run}
                openStep={openStep}
                onToggleStep={(name) => setOpenStep((current) => (current === name ? null : name))}
              />
              {selected.verdict && (
                <VerdictCard verdict={selected.verdict} remediationPr={REMEDIATION_PR} />
              )}
            </>
          ) : (
            <PipelinePageEmpty />
          )}
        </div>
      </div>
    </>
  )
}
