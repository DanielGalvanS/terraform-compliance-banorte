import { useState } from 'react'
import { useFilters, useToast } from '@/shared/hooks'
import { Button, Card, DataTable, FuenteDeDatos, PageTitle, Toast } from '@/shared/ui'
import { defaultFindingFilters, findingsRepository } from '../api/findingsRepository'
import { useFindings } from '../hooks/useFindings'
import type { Finding } from '../model'
import { FindingDrawer } from './FindingDrawer'
import { FindingFilters } from './FindingFilters'
import { findingColumns } from './findingColumns'
import { SeverityStats } from './SeverityStats'

export function FindingsPage() {
  const carga = useFindings()
  const { values, set, reset } = useFilters(defaultFindingFilters)
  const [selected, setSelected] = useState<Finding | null>(null)
  const toast = useToast()

  const titulo = (
    <PageTitle
      eyebrow="RIESGO · CUMPLIMIENTO"
      title="Hallazgos y drift"
      description="Incumplimientos detectados en planes, eventos y estado real de GCP."
      action={
        <>
          {carga.estado === 'listo' && <FuenteDeDatos fuente={carga.fuente} />}
          <Button variant="secondary" icon="download">
            Exportar CSV
          </Button>
        </>
      }
    />
  )

  if (carga.estado === 'cargando') {
    return (
      <>
        {titulo}
        <Card>
          <p>Consultando la API de cumplimiento…</p>
        </Card>
      </>
    )
  }

  if (carga.estado === 'error') {
    // No se cae a los datos de ejemplo: eso aparentaría que la API responde.
    return (
      <>
        {titulo}
        <Card>
          <h2>No se pudieron cargar los hallazgos</h2>
          <p>{carga.mensaje}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </Card>
      </>
    )
  }

  const visible = findingsRepository.query(values, carga.hallazgos)

  return (
    <>
      {titulo}
      <FindingFilters
        values={values}
        options={findingsRepository.getFilterOptions(carga.hallazgos)}
        onChange={set}
        onClear={reset}
      />
      <SeverityStats summary={findingsRepository.getSummary()} />
      <DataTable
        className="findings-table"
        columns={findingColumns}
        rows={visible}
        rowKey={(row) => row.id}
        onRowClick={setSelected}
        emptyMessage="Ningún hallazgo coincide con los filtros"
      />
      {selected && (
        <FindingDrawer
          finding={selected}
          onClose={() => setSelected(null)}
          onAction={toast.show}
        />
      )}
      <Toast message={toast.message} />
    </>
  )
}
