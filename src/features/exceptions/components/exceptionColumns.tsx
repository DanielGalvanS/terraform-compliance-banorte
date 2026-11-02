import { Badge, type Column } from '@/shared/ui'
import { environmentTone, severityTone } from '@/shared/model'
import { formatExpiry, isExpiryUrgent } from '../model/expiry'
import { exceptionStateTone, type ComplianceException } from '../model'

type ColumnOptions = {
  onOpenDetail: (row: ComplianceException) => void
}

export function exceptionColumns({ onOpenDetail }: ColumnOptions): Column<ComplianceException>[] {
  return [
    {
      id: 'control',
      header: 'Control',
      render: (row) => (
        <>
          <strong>{row.controlCode}</strong>
          <small>{row.controlName}</small>
        </>
      ),
    },
    { id: 'framework', header: 'Marco', render: (row) => row.framework },
    { id: 'resource', header: 'Recurso afectado', render: (row) => <code>{row.resource}</code> },
    {
      id: 'environment',
      header: 'Ambiente',
      render: (row) => <Badge tone={environmentTone(row.environment)}>{row.environment}</Badge>,
    },
    {
      id: 'severity',
      header: 'Severidad',
      render: (row) => <Badge tone={severityTone(row.severity)}>{row.severity}</Badge>,
    },
    {
      id: 'justification',
      header: 'Justificación',
      className: 'exception-reason',
      render: (row) => row.justification,
    },
    { id: 'approver', header: 'Aprobador', render: (row) => row.approver },
    {
      id: 'expires',
      header: 'Vigencia hasta ↑',
      render: (row) => (
        <>
          <strong>{row.expiresOn}</strong>
          <small className={isExpiryUrgent(row.expiresOn) ? 'expiry-alert' : undefined}>
            {formatExpiry(row.expiresOn)}
          </small>
        </>
      ),
    },
    {
      id: 'state',
      header: 'Estado',
      render: (row) => <Badge tone={exceptionStateTone(row.state)}>{row.state}</Badge>,
    },
    {
      id: 'actions',
      header: 'Acciones',
      render: (row) => (
        <button type="button" className="table-action" onClick={() => onOpenDetail(row)}>
          Ver detalle
        </button>
      ),
    },
  ]
}
