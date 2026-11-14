import { useState } from 'react'
import { useEnvironment } from '@/app/providers/EnvironmentProvider'
import { useAuth } from '@/features/auth'
import { useFilters, useToast } from '@/shared/hooks'
import { ErrorValidacion } from '@/shared/api'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  FuenteDeDatos,
  PageTitle,
  StatCard,
  Toast,
} from '@/shared/ui'
import { defaultExceptionFilters, exceptionsRepository } from '../api/exceptionsRepository'
import { useExcepcionesApi } from '../hooks/useExcepcionesApi'
import type { ValidationErrors } from '../model/validation'
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
  const { estado: carga, crear } = useExcepcionesApi(user?.name ?? 'Equipo de cumplimiento')
  const { values, set, reset } = useFilters(defaultExceptionFilters)
  const [search, setSearch] = useState('')
  const [drawer, setDrawer] = useState<DrawerMode>(null)
  const toast = useToast()

  const titulo = (
    <PageTitle
      eyebrow="RIESGO · CUMPLIMIENTO"
      title="Excepciones"
      description="Gestiona incumplimientos aceptados temporalmente y su vigencia."
      action={
        <>
          {carga.estado === 'listo' && <FuenteDeDatos fuente={carga.fuente} />}
          <Button icon="shield" onClick={() => setDrawer({ kind: 'new' })}>
            Nueva excepción
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
          <p>Consultando el registro de excepciones…</p>
        </Card>
      </>
    )
  }

  if (carga.estado === 'error') {
    return (
      <>
        {titulo}
        <Card>
          <h2>No se pudo cargar el registro</h2>
          <p>{carga.mensaje}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </Card>
      </>
    )
  }

  const items = carga.items
  const visible = exceptionsRepository.query(items, { filters: values, search })

  const clearAll = () => {
    reset()
    setSearch('')
  }

  return (
    <>
      {titulo}
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
            onSubmit={async (input) => {
              try {
                await crear({
                  control: input.control,
                  recurso: input.resource,
                  ambiente: input.environment,
                  justificacion: input.justification,
                  venceEl: input.expiresOn,
                  aprobador: input.approver,
                  ...(input.remediationPlan.trim()
                    ? { planRemediacion: input.remediationPlan.trim() }
                    : {}),
                })
                setDrawer(null)
                toast.show('Excepción enviada para aprobación')
              } catch (causa) {
                // La API rechaza por campo: se pintan en el formulario en vez
                // de mostrar un mensaje genérico que no dice qué corregir.
                if (causa instanceof ErrorValidacion) {
                  const errores: ValidationErrors = {}
                  for (const motivo of causa.motivos) {
                    if (motivo.campo === 'justificacion') errores.justification = motivo.mensaje
                    else if (motivo.campo === 'venceEl') errores.expiresOn = motivo.mensaje
                    else if (motivo.campo === 'control') errores.control = motivo.mensaje
                  }
                  return errores
                }
                toast.show('No se pudo enviar la excepción')
                return
              }
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
