import { useDisclosure, useToast } from '@/shared/hooks'
import { Button, PageTitle, Toast } from '@/shared/ui'
import { performanceRepository } from '../api/performanceRepository'
import { useTestRun } from '../hooks/useTestRun'
import { DestroyEnvironmentModal } from './DestroyEnvironmentModal'
import { RunResultsCard } from './RunResultsCard'
import { TestConfigCard } from './TestConfigCard'

export function PerformancePage() {
  const { isRunning, start } = useTestRun()
  const destroyDialog = useDisclosure()
  const toast = useToast()
  const destroyTarget = performanceRepository.getDestroyTarget()

  return (
    <>
      <PageTitle
        eyebrow="VALIDACIÓN TÉCNICA"
        title="Pruebas de rendimiento"
        description="Mide el ambiente desplegado y compara resultados entre ejecuciones."
        action={
          <Button variant="danger" icon="trash" onClick={destroyDialog.open}>
            Destruir ambiente
          </Button>
        }
      />
      <div className="perf-layout">
        <TestConfigCard
          config={performanceRepository.getRunConfig()}
          isRunning={isRunning}
          onRun={start}
        />
        <RunResultsCard run={performanceRepository.getLatestRun()} isRunning={isRunning} />
      </div>
      {destroyDialog.isOpen && (
        <DestroyEnvironmentModal
          target={destroyTarget}
          onCancel={destroyDialog.close}
          onConfirm={() => {
            destroyDialog.close()
            toast.show('Destrucción programada. Se requiere aprobación humana final.')
          }}
        />
      )}
      <Toast message={toast.message} />
    </>
  )
}
