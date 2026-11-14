import { Badge, Icon, type Column } from '@/shared/ui'
import { environmentTone, severityTone } from '@/shared/model'
import type { Finding } from '../model'

export const findingColumns: Column<Finding>[] = [
  {
    id: 'severity',
    header: 'Severidad',
    render: (row) => <Badge tone={severityTone(row.severity)}>{row.severity}</Badge>,
  },
  {
    id: 'title',
    header: 'Hallazgo',
    render: (row) => (
      <>
        <strong>{row.title}</strong>
        <small>{row.id}</small>
      </>
    ),
  },
  { id: 'resource', header: 'Recurso', render: (row) => <code>{row.resource}</code> },
  {
    id: 'control',
    header: 'Control / Marco',
    render: (row) => (
      <>
        {/* El control interno encabeza: es el que decide el bloqueo. El marco
            queda como referencia para el auditor. */}
        <strong>{row.catalogControl ?? row.framework}</strong>
        <small>
          {row.catalogControl ? `${row.framework} ${row.control}` : row.control}
        </small>
      </>
    ),
  },
  { id: 'origin', header: 'Origen', render: (row) => row.origin },
  {
    id: 'environment',
    header: 'Ambiente',
    render: (row) => <Badge tone={environmentTone(row.environment)}>{row.environment}</Badge>,
  },
  { id: 'state', header: 'Estado', render: (row) => row.state },
  { id: 'open', header: '', render: () => <Icon name="chevron" size={16} /> },
]
