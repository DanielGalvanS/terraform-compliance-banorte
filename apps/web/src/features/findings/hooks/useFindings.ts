import { useEffect, useState } from 'react'
import { clienteApi, hayApi } from '@/shared/api'
import type { Fuente } from '@/shared/ui'
import { findingsRepository } from '../api/findingsRepository'
import { desdeApi } from '../api/mapeo'
import type { Finding } from '../model'

export type EstadoHallazgos =
  | { estado: 'cargando' }
  | { estado: 'listo'; hallazgos: Finding[]; fuente: Fuente }
  | { estado: 'error'; mensaje: string }

/**
 * Carga los hallazgos de la API cuando hay una configurada.
 *
 * Sin `VITE_API_URL` devuelve los datos de ejemplo de inmediato, para que el
 * prototipo siga siendo demostrable sin levantar nada. Cuando sí la hay y
 * falla, se muestra el error: caer en silencio a los datos de ejemplo haría
 * parecer que la API funciona cuando no responde.
 */
export function useFindings(): EstadoHallazgos {
  const [estado, setEstado] = useState<EstadoHallazgos>(() =>
    hayApi
      ? { estado: 'cargando' }
      : { estado: 'listo', hallazgos: findingsRepository.getFindings(), fuente: 'ejemplo' },
  )

  useEffect(() => {
    if (!hayApi) return

    const control = new AbortController()
    clienteApi
      .listarHallazgos(control.signal)
      .then((respuesta) => {
        setEstado({
          estado: 'listo',
          hallazgos: respuesta.hallazgos.map(desdeApi),
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
