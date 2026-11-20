import { Badge, CardHeader, DataTable, FuenteDeDatos, IconButton, type Column, type Fuente } from '@/shared/ui'
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

type EvidenceLogCardProps = {
  entries: EvidenceEntry[]
  /** `null` cuando no hay API: sin cadena que verificar no se puede afirmar nada. */
  integra: boolean | null
  fuente: Fuente
}

/**
 * El distintivo dice lo que la API respondió, no «verificada» siempre.
 *
 * Una cadena de evidencia que se anuncia íntegra pase lo que pase no prueba
 * nada: el valor está justo en que pueda decir que no.
 */
function Integridad({ integra, fuente }: { integra: boolean | null; fuente: Fuente }) {
  if (fuente !== 'api' || integra === null) return <FuenteDeDatos fuente={fuente} />
  return integra ? (
    <Badge tone="success">Cadena íntegra</Badge>
  ) : (
    <Badge tone="critical">Cadena alterada</Badge>
  )
}

export function EvidenceLogCard({ entries, integra, fuente }: EvidenceLogCardProps) {
  const subtitulo =
    fuente === 'api'
      ? `${entries.length} ${entries.length === 1 ? 'evento' : 'eventos'} · cadena verificada en cada consulta`
      : 'Bucket WORM · retención 7 años'

  return (
    <DataTable
      className="evidence-log"
      columns={columns}
      rows={entries}
      rowKey={(row) => row.id}
      header={
        <CardHeader
          title="Registro inmutable de evidencias"
          subtitle={subtitulo}
          aside={<Integridad integra={integra} fuente={fuente} />}
        />
      }
    />
  )
}
