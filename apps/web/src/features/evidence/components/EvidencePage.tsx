import { exceptionsRepository } from '@/features/exceptions'
import { useDisclosure, useToast } from '@/shared/hooks'
import { Button, PageTitle, Toast } from '@/shared/ui'
import { evidenceRepository } from '../api/evidenceRepository'
import { ActiveExceptionsCard } from './ActiveExceptionsCard'
import { AuditExportModal } from './AuditExportModal'
import { CoverageCard } from './CoverageCard'
import { EvidenceLogCard } from './EvidenceLogCard'
import { ReportBuilder } from './ReportBuilder'

export function EvidencePage() {
  const exportDialog = useDisclosure()
  const toast = useToast()
  const activeExceptions = exceptionsRepository
    .list()
    .filter((exception) => exception.state === 'Activa')

  return (
    <>
      <PageTitle
        eyebrow="AUDITORÍA · TRAZABILIDAD"
        title="Evidencia y reportes"
        description="Registro verificable de controles, decisiones y cambios de infraestructura."
        action={
          <Button icon="download" onClick={exportDialog.open}>
            Exportar para auditoría
          </Button>
        }
      />
      <ReportBuilder
        options={evidenceRepository.getReportOptions()}
        onGenerate={() => toast.show('Reporte en preparación. Te avisaremos al terminar.')}
      />
      <div className="evidence-grid">
        <EvidenceLogCard entries={evidenceRepository.getEvidenceLog()} />
        <CoverageCard coverage={evidenceRepository.getCoverage()} />
      </div>
      <ActiveExceptionsCard exceptions={activeExceptions} />
      {exportDialog.isOpen && (
        <AuditExportModal
          formats={evidenceRepository.getExportFormats()}
          onClose={exportDialog.close}
          onExport={() => {
            exportDialog.close()
            toast.show('Paquete de auditoría generado')
          }}
        />
      )}
      <Toast message={toast.message} />
    </>
  )
}
