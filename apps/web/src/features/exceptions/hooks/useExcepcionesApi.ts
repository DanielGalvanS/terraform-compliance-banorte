import { useCallback, useEffect, useState } from 'react'
import { clienteApi, hayApi, type NuevaExcepcionApi } from '@/shared/api'
import type { Fuente } from '@/shared/ui'
import { exceptionsRepository } from '../api/exceptionsRepository'
import { desdeApi } from '../api/mapeo'
import type { ComplianceException } from '../model'

export type EstadoExcepciones =
  | { estado: 'cargando' }
  | { estado: 'listo'; items: ComplianceException[]; fuente: Fuente }
  | { estado: 'error'; mensaje: string }

/**
 * Registro de excepciones, de la API cuando la hay.
 *
 * Tras dar de alta una, se vuelve a pedir la lista en lugar de insertar la
 * respuesta en memoria. Es una petición más, pero la lista refleja lo que la
 * API realmente guardó: el estado y el código los decide ella, no el cliente.
 */
export function useExcepcionesApi(solicitante: string) {
  const [estado, setEstado] = useState<EstadoExcepciones>(() =>
    hayApi
      ? { estado: 'cargando' }
      : { estado: 'listo', items: exceptionsRepository.list(), fuente: 'ejemplo' },
  )

  const cargar = useCallback(async (señal?: AbortSignal) => {
    if (!hayApi) return
    try {
      const respuesta = await clienteApi.listarExcepciones(señal)
      setEstado({ estado: 'listo', items: respuesta.excepciones.map(desdeApi), fuente: 'api' })
    } catch (causa) {
      if (señal?.aborted) return
      setEstado({
        estado: 'error',
        mensaje: causa instanceof Error ? causa.message : 'Error desconocido',
      })
    }
  }, [])

  useEffect(() => {
    const control = new AbortController()
    void cargar(control.signal)
    return () => control.abort()
  }, [cargar])

  /**
   * Lanza ErrorValidacion con el detalle por campo si la API rechaza.
   *
   * Quién solicita no viaja en el cuerpo: la API lo toma del token de la sesión.
   */
  const crear = useCallback(
    async (nueva: NuevaExcepcionApi) => {
      if (!hayApi) {
        // Sin API, el alta vive solo en la sesión, como el resto del prototipo.
        setEstado((actual) =>
          actual.estado === 'listo'
            ? {
                ...actual,
                items: [
                  exceptionsRepository.build(
                    {
                      control: nueva.control,
                      resource: nueva.recurso,
                      environment: nueva.ambiente,
                      justification: nueva.justificacion,
                      expiresOn: nueva.venceEl,
                      approver: nueva.aprobador,
                      remediationPlan: nueva.planRemediacion ?? '',
                    },
                    actual.items,
                    solicitante,
                  ),
                  ...actual.items,
                ],
              }
            : actual,
        )
        return
      }
      await clienteApi.crearExcepcion(nueva)
      await cargar()
    },
    [cargar, solicitante],
  )

  return { estado, crear }
}
