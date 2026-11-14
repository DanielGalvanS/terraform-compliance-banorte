import { useState } from 'react'
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  FuenteDeDatos,
  PageTitle,
  SearchInput,
  StatCard,
} from '@/shared/ui'
import { ALL_MODULES, inventoryRepository } from '../api/inventoryRepository'
import { useInventario } from '../hooks/useInventario'
import { ModuleFilterCard } from './ModuleFilterCard'
import { NetworkTopologyCard } from './NetworkTopologyCard'
import { resourceColumns } from './resourceColumns'

export function InventoryPage() {
  const carga = useInventario()
  const [module, setModule] = useState(ALL_MODULES)
  const [search, setSearch] = useState('')

  const titulo = (
    <PageTitle
      eyebrow="GCP · INVENTARIO"
      title="Inventario del mini data center"
      description="Recursos gestionados por Terraform y su postura de cumplimiento."
      action={
        <>
          {carga.estado === 'listo' && <FuenteDeDatos fuente={carga.fuente} />}
          <Button variant="secondary" icon="download">
            Exportar inventario
          </Button>
          <Button icon="cloud">Sincronizar GCP</Button>
        </>
      }
    />
  )

  if (carga.estado === 'cargando') {
    return (
      <>
        {titulo}
        <Card>
          <p>Consultando el inventario…</p>
        </Card>
      </>
    )
  }

  if (carga.estado === 'error') {
    return (
      <>
        {titulo}
        <Card>
          <h2>No se pudo cargar el inventario</h2>
          <p>{carga.mensaje}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </Card>
      </>
    )
  }

  const visible = inventoryRepository.queryResources({ module, search }, carga.recursos)

  return (
    <>
      {titulo}
      <div className="inventory-summary">
        {carga.resumen.map((summary) => (
          <StatCard
            key={summary.label}
            label={summary.label}
            value={summary.value}
            footnote={summary.footnote}
            footnoteClassName={summary.alert ? 'red-text' : undefined}
          />
        ))}
      </div>
      <div className="inventory-grid">
        <NetworkTopologyCard topology={inventoryRepository.getTopology()} />
        <ModuleFilterCard
          modules={inventoryRepository.getModules()}
          selected={module}
          onSelect={setModule}
        />
      </div>
      <DataTable
        columns={resourceColumns}
        rows={visible}
        rowKey={(row) => row.name}
        emptyMessage="Ningún recurso coincide con la búsqueda"
        header={
          <CardHeader
            title="Recursos"
            subtitle={`${visible.length} de ${carga.recursos.length} recursos`}
            aside={
              <SearchInput
                label="Buscar recursos"
                placeholder="Buscar recurso…"
                value={search}
                onChange={setSearch}
              />
            }
          />
        }
      />
    </>
  )
}
