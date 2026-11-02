import { Badge, CardHeader, DataTable, IconButton, type Column } from '@/shared/ui'
import type { EvidenceEntry } from '../model'

const columns: Column<EvidenceEntry>[] = [
  {
    id: 'id',
    header: 'ID / Evidencia',
    render: (row) => (
      <>
        <code>{row.id}</code>
        <small>{row.description}</small>
      </>
    ),
  },
  { id: 'date', header: 'Fecha', render: (row) => row.dateLabel },
  { id: 'hash', header: 'Hash', render: (row) => <code>{row.hash}</code> },
  { id: 'source', header: 'Fuente', render: (row) => row.source },
  {
    id: 'download',
    header: '',
    render: (row) => (
      <IconButton icon="download" size={15} label={`Descargar evidencia ${row.id}`} />
    ),
  },
]

export function EvidenceLogCard({ entries }: { entries: EvidenceEntry[] }) {
  return (
    <DataTable
      className="evidence-log"
      columns={columns}
      rows={entries}
      rowKey={(row) => row.id}
      header={
        <CardHeader
          title="Registro inmutable de evidencias"
          subtitle="Bucket WORM · retención 7 años"
          aside={<Badge tone="success">Cadena verificada</Badge>}
        />
      }
    />
  )
}
