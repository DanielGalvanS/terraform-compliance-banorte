import { useCallback, useEffect, useState } from 'react'
import { clienteApi, hayApi } from '@/shared/api'
import type { Fuente } from '@/shared/ui'
import { evidenceRepository } from '../api/evidenceRepository'
import { desdeApi } from '../api/mapeo'
import type { EvidenceEntry } from '../model'

export type EstadoEvidencia =
  | { estado: 'cargando' }
  | {
      estado: 'listo'
      entradas: EvidenceEntry[]
      /**
       * Si la cadena de hashes sigue coincidiendo. Sin API no se sabe, y por
       * eso es `null`: el prototipo no puede afirmar que algo está verificado.
       */
      integra: boolean | null
      fuente: Fuente
    }
  | { estado: 'error'; mensaje: string }

const SIN_API: EstadoEvidencia = {
  estado: 'listo',
  entradas: evidenceRepository.getEvidenceLog(),
  integra: null,
  fuente: 'ejemplo',
}

/**
 * Registro de evidencia, de la API cuando la hay.
 *
 * La API verifica la cadena completa en cada consulta y responde `integra`.
 * Se guarda tal cual en lugar de recalcularla aquí: el cliente no tiene los
 * eventos que el filtro dejó fuera, y una cadena se verifica entera o no se
 * verifica.
 */
export function useEvidenciaApi() {
  const [estado, setEstado] = useState<EstadoEvidencia>(() =>
    hayApi ? { estado: 'cargando' } : SIN_API,
  )

  const cargar = useCallback(async (señal?: AbortSignal) => {
    if (!hayApi) return
    try {
      const respuesta = await clienteApi.listarEvidencia(señal)
      setEstado({
        estado: 'listo',
        entradas: respuesta.eventos.map(desdeApi),
        integra: respuesta.integra,
        fuente: 'api',
      })
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

  return estado
}
