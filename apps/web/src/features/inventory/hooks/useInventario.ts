import { useEffect, useState } from 'react'
import { clienteApi, hayApi, type RespuestaRecursos } from '@/shared/api'
import type { Fuente } from '@/shared/ui'
import { inventoryRepository } from '../api/inventoryRepository'
import { desdeApi } from '../api/mapeo'
import type { InventorySummary, Resource } from '../model'

export type EstadoInventario =
  | { estado: 'cargando' }
  | {
      estado: 'listo'
      recursos: Resource[]
      resumen: InventorySummary[]
      fuente: Fuente
    }
  | { estado: 'error'; mensaje: string }

/** Las tarjetas de resumen, con las cifras que la API calculó. */
function resumenDesdeApi(resumen: RespuestaRecursos['resumen']): InventorySummary[] {
  return [
    {
      label: 'Recursos gestionados',
      value: String(resumen.total),
      footnote: '100% en Terraform',
    },
    {
      label: 'Módulos activos',
      value: String(resumen.modulos),
      footnote: 'Módulos aprobados en uso',
    },
    {
      label: 'Cobertura de etiquetas',
      value: `${resumen.coberturaEtiquetas}%`,
      footnote: `${resumen.total - resumen.conEtiquetasCompletas} recursos incompletos`,
      alert: resumen.conEtiquetasCompletas < resumen.total,
    },
    {
      label: 'No conformes',
      value: String(resumen.noConformes),
      footnote: 'Con hallazgos abiertos',
      alert: resumen.noConformes > 0,
    },
  ]
}

export function useInventario(): EstadoInventario {
  const [estado, setEstado] = useState<EstadoInventario>(() =>
    hayApi
      ? { estado: 'cargando' }
      : {
          estado: 'listo',
          recursos: inventoryRepository.getResources(),
          resumen: inventoryRepository.getSummaries(),
          fuente: 'ejemplo',
        },
  )

  useEffect(() => {
    if (!hayApi) return

    const control = new AbortController()
    clienteApi
      .listarRecursos(control.signal)
      .then((respuesta) => {
        setEstado({
          estado: 'listo',
          recursos: respuesta.recursos.map(desdeApi),
          resumen: resumenDesdeApi(respuesta.resumen),
          fuente: 'api',
        })
      })
      .catch((causa: unknown) => {
        if (control.signal.aborted) return
        setEstado({
          estado: 'error',
          mensaje: causa instanceof Error ? causa.message : 'Error desconocido',
        })
      })

    return () => control.abort()
  }, [])

  return estado
}
