import type { paths } from './contrato'

/**
 * Cliente HTTP de la API de cumplimiento.
 *
 * Los tipos salen de `contrato.d.ts`, generado del OpenAPI que publica la
 * propia API. Si un campo cambia allá, esto deja de compilar: el error aparece
 * en el pull request y no cuando alguien abre la pantalla.
 */

/** Sin esta variable el frontend usa sus datos de ejemplo. */
export const URL_API: string | undefined = import.meta.env['VITE_API_URL']

export const hayApi = URL_API !== undefined && URL_API !== ''

export type RespuestaHallazgos =
  paths['/hallazgos']['get']['responses'][200]['content']['application/json']

export type HallazgoApi = RespuestaHallazgos['hallazgos'][number]

export type RespuestaResumen =
  paths['/resumen']['get']['responses'][200]['content']['application/json']

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly estado?: number,
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
  }
}

/** Corta la espera: una API colgada no debe dejar la pantalla en blanco. */
const TIEMPO_LIMITE_MS = 5000

async function pedir<T>(ruta: string, señal?: AbortSignal): Promise<T> {
  if (!hayApi) throw new ErrorApi('No hay API configurada')

  let respuesta: Response
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      headers: { accept: 'application/json' },
      signal: señal ?? AbortSignal.timeout(TIEMPO_LIMITE_MS),
    })
  } catch (causa) {
    throw new ErrorApi(
      causa instanceof DOMException && causa.name === 'TimeoutError'
        ? 'La API no respondió a tiempo'
        : 'No se pudo contactar con la API',
    )
  }

  if (!respuesta.ok) {
    throw new ErrorApi(`La API respondió ${respuesta.status}`, respuesta.status)
  }
  return (await respuesta.json()) as T
}

export const clienteApi = {
  listarHallazgos: (señal?: AbortSignal) =>
    pedir<RespuestaHallazgos>('/hallazgos', señal),
  resumen: (señal?: AbortSignal) => pedir<RespuestaResumen>('/resumen', señal),
}
