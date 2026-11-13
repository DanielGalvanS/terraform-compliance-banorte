import { useState } from 'react'
import { useEnvironment } from '@/app/providers/EnvironmentProvider'
import { useAuth } from '@/features/auth'
import { useFilters, useToast } from '@/shared/hooks'
import { Badge, Button, DataTable, Drawer, PageTitle, StatCard, Toast } from '@/shared/ui'
import { defaultExceptionFilters, exceptionsRepository } from '../api/exceptionsRepository'
import { useExceptions } from '../hooks/useExceptions'
import { exceptionStateTone, type ComplianceException } from '../model'
import { ExceptionDetail } from './ExceptionDetail'
import { ExceptionFilters } from './ExceptionFilters'
import { exceptionColumns } from './exceptionColumns'
import { NewExceptionForm } from './NewExceptionForm'

/** Which panel the drawer shows, if any. */
type DrawerMode = { kind: 'new' } | { kind: 'detail'; exception: ComplianceException } | null

export function ExceptionsPage() {
  const { environment } = useEnvironment()
  const { user } = useAuth()
  const { items, create } = useExceptions(user?.name ?? 'Equipo de cumplimiento')
  const { values, set, reset } = useFilters(defaultExceptionFilters)
  const [search, setSearch] = useState('')
  const [drawer, setDrawer] = useState<DrawerMode>(null)
  const toast = useToast()

  const visible = exceptionsRepository.query(items, { filters: values, search })

  const clearAll = () => {
    reset()
    setSearch('')
  }

  return (
    <>
      <PageTitle
        eyebrow="RIESGO · CUMPLIMIENTO"
        title="Excepciones"
        description="Gestiona incumplimientos aceptados temporalmente y su vigencia."
        action={
          <Button icon="shield" onClick={() => setDrawer({ kind: 'new' })}>
            Nueva excepción
          </Button>
        }
      />
      <div className="exception-stats">
        {exceptionsRepository.getStats(items).map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            footnote={<Badge tone={stat.tone}>{stat.label.split(' · ')[0]}</Badge>}
          />
        ))}
      </div>
      <ExceptionFilters
        values={values}
        options={exceptionsRepository.getFilterOptions()}
        search={search}
        onChange={set}
        onSearchChange={setSearch}
        onClear={clearAll}
      />
      <DataTable
        className="exceptions-table"
        columns={exceptionColumns({
          onOpenDetail: (exception) => setDrawer({ kind: 'detail', exception }),
        })}
        rows={visible}
        rowKey={(row) => row.id}
        emptyMessage="No hay excepciones registradas"
      />
      {drawer?.kind === 'new' && (
        <Drawer
          className="exception-drawer"
          onClose={() => setDrawer(null)}
          header={
            <>
              <span className="eyebrow">NUEVA SOLICITUD</span>
              <h2>Nueva excepción</h2>
            </>
          }
        >
          <NewExceptionForm
            defaultEnvironment={environment}
            onCancel={() => setDrawer(null)}
            onSubmit={(input) => {
              create(input)
              setDrawer(null)
              toast.show('Excepción enviada para aprobación')
            }}
          />
        </Drawer>
      )}
      {drawer?.kind === 'detail' && (
        <Drawer
          className="exception-drawer"
          onClose={() => setDrawer(null)}
          header={
            <>
              <span className="eyebrow">{drawer.exception.id}</span>
              <h2>{drawer.exception.controlName}</h2>
              <Badge tone={exceptionStateTone(drawer.exception.state)}>
                {drawer.exception.state}
              </Badge>
            </>
          }
        >
          <ExceptionDetail exception={drawer.exception} />
        </Drawer>
      )}
      <Toast message={toast.message} />
    </>
  )
}
