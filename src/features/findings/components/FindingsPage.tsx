import { useState } from 'react'
import { useFilters, useToast } from '@/shared/hooks'
import { Button, DataTable, PageTitle, Toast } from '@/shared/ui'
import { defaultFindingFilters, findingsRepository } from '../api/findingsRepository'
import type { Finding } from '../model'
import { FindingDrawer } from './FindingDrawer'
import { FindingFilters } from './FindingFilters'
import { findingColumns } from './findingColumns'
import { SeverityStats } from './SeverityStats'

export function FindingsPage() {
  const { values, set, reset } = useFilters(defaultFindingFilters)
  const [selected, setSelected] = useState<Finding | null>(null)
  const toast = useToast()
  const visible = findingsRepository.query(values)

  return (
    <>
      <PageTitle
        eyebrow="RIESGO · CUMPLIMIENTO"
        title="Hallazgos y drift"
        description="Incumplimientos detectados en planes, eventos y estado real de GCP."
        action={
          <Button variant="secondary" icon="download">
            Exportar CSV
          </Button>
        }
      />
      <FindingFilters
        values={values}
        options={findingsRepository.getFilterOptions()}
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
