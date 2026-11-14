import { useEffect, useState } from 'react'
import { clienteApi, hayApi, type RespuestaResumen } from '@/shared/api'
import type { Fuente } from '@/shared/ui'

export type EstadoResumen =
  | { estado: 'cargando' }
  | { estado: 'listo'; resumen: RespuestaResumen; fuente: Extract<Fuente, 'api'> }
  | { estado: 'sinApi' }
  | { estado: 'error'; mensaje: string }

/**
 * Carga las cifras de portada.
 *
 * A diferencia de los hallazgos, aquí un fallo no vacía la pantalla: el
 * tablero tiene otras tarjetas que no dependen de la API. Se devuelve el
 * estado y cada tarjeta decide, para que una API caída no esconda lo que sí
 * se puede mostrar.
 */
export function useResumen(): EstadoResumen {
  const [estado, setEstado] = useState<EstadoResumen>(() =>
    hayApi ? { estado: 'cargando' } : { estado: 'sinApi' },
  )

  useEffect(() => {
    if (!hayApi) return

    const control = new AbortController()
    clienteApi
      .resumen(control.signal)
      .then((resumen) => setEstado({ estado: 'listo', resumen, fuente: 'api' }))
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
