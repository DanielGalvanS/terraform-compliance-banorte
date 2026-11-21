import { exceptionsRepository } from '@/features/exceptions'
import { useDisclosure, useToast } from '@/shared/hooks'
import { Button, Card, PageTitle, Toast } from '@/shared/ui'
import { evidenceRepository } from '../api/evidenceRepository'
import { useEvidenciaApi } from '../hooks/useEvidenciaApi'
import { ActiveExceptionsCard } from './ActiveExceptionsCard'
import { AuditExportModal } from './AuditExportModal'
import { CoverageCard } from './CoverageCard'
import { EvidenceLogCard } from './EvidenceLogCard'
import { ReportBuilder } from './ReportBuilder'

export function EvidencePage() {
  const exportDialog = useDisclosure()
  const toast = useToast()
  const evidencia = useEvidenciaApi()
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
      {evidencia.estado === 'error' && (
        // Se avisa, pero no se inventa un registro: una pantalla de evidencia
        // vacía es preferible a una que muestre algo que nadie respalda.
        <Card>
          <strong>No se pudo consultar el registro de evidencia: {evidencia.mensaje}</strong>
          <p>Vuelve a cargar la página cuando la API esté disponible.</p>
        </Card>
      )}
      <ReportBuilder
        options={evidenceRepository.getReportOptions()}
        onGenerate={() => toast.show('Reporte en preparación. Te avisaremos al terminar.')}
      />
      <div className="evidence-grid">
        {evidencia.estado === 'listo' && (
          <EvidenceLogCard
            entries={evidencia.entradas}
            integra={evidencia.integra}
            fuente={evidencia.fuente}
          />
        )}
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
