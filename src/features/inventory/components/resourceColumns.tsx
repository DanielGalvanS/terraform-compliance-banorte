import { Badge, TagList, type Column } from '@/shared/ui'
import { environmentTone } from '@/shared/model'
import { complianceTone, type Resource } from '../model'

/** Column definitions for the managed-resource table. */
export const resourceColumns: Column<Resource>[] = [
  { id: 'name', header: 'Recurso', render: (row) => <code>{row.name}</code> },
  { id: 'module', header: 'Módulo', render: (row) => row.module },
  { id: 'version', header: 'Versión', render: (row) => <code>{row.moduleVersion}</code> },
  {
    id: 'environment',
    header: 'Ambiente',
    render: (row) => <Badge tone={environmentTone(row.environment)}>{row.environment}</Badge>,
  },
  {
    id: 'state',
    header: 'Estado',
    render: (row) => <Badge tone={complianceTone(row.state)}>{row.state}</Badge>,
  },
  {
    id: 'tags',
    header: 'Etiquetas obligatorias',
    render: (row) => <TagList tags={row.tags} />,
  },
]
