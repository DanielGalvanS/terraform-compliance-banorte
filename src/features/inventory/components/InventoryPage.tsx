import { useState } from 'react'
import { Button, CardHeader, DataTable, PageTitle, SearchInput, StatCard } from '@/shared/ui'
import { ALL_MODULES, inventoryRepository } from '../api/inventoryRepository'
import { ModuleFilterCard } from './ModuleFilterCard'
import { NetworkTopologyCard } from './NetworkTopologyCard'
import { resourceColumns } from './resourceColumns'

export function InventoryPage() {
  const [module, setModule] = useState(ALL_MODULES)
  const [search, setSearch] = useState('')
  const visible = inventoryRepository.queryResources({ module, search })

  return (
    <>
      <PageTitle
        eyebrow="GCP · 184 RECURSOS"
        title="Inventario del mini data center"
        description="Recursos gestionados por Terraform y su postura de cumplimiento."
        action={
          <>
            <Button variant="secondary" icon="download">
              Exportar inventario
            </Button>
            <Button icon="cloud">Sincronizar GCP</Button>
          </>
        }
      />
      <div className="inventory-summary">
        {inventoryRepository.getSummaries().map((summary) => (
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
            subtitle={`${visible.length} resultados mostrados`}
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
