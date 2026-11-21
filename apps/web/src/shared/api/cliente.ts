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

export type CoberturaMarco = RespuestaResumen['coberturaPorMarco'][number]

export type RespuestaExcepciones =
  paths['/excepciones']['get']['responses'][200]['content']['application/json']

export type ExcepcionApi = RespuestaExcepciones['excepciones'][number]

export type RespuestaRecursos =
  paths['/recursos']['get']['responses'][200]['content']['application/json']

export type RecursoApi = RespuestaRecursos['recursos'][number]

export type RespuestaEvidencia =
  paths['/evidencia']['get']['responses'][200]['content']['application/json']

export type EventoEvidenciaApi = RespuestaEvidencia['eventos'][number]

export type NuevaExcepcionApi =
  paths['/excepciones']['post']['requestBody']['content']['application/json']

export type CredencialesApi =
  paths['/sesion']['post']['requestBody']['content']['application/json']

export type SesionApi =
  paths['/sesion']['post']['responses'][200]['content']['application/json']

/**
 * Token de la sesión. Vive en memoria y no en localStorage: un script inyectado
 * en la página podría leer localStorage y llevárselo. El costo es que al
 * recargar hay que volver a iniciar sesión.
 */
let tokenActual: string | null = null
let alExpirar: (() => void) | null = null

export function establecerToken(token: string | null) {
  tokenActual = token
}

/** Lo llama la API cuando responde 401: el token venció o ya no es válido. */
export function alSesionExpirada(accion: (() => void) | null) {
  alExpirar = accion
}

function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return {
    accept: 'application/json',
    ...(tokenActual === null ? {} : { authorization: `Bearer ${tokenActual}` }),
    ...extra,
  }
}

function revisarSesion(respuesta: Response) {
  if (respuesta.status === 401 && tokenActual !== null) {
    tokenActual = null
    alExpirar?.()
  }
}

/** Motivos de rechazo que devuelve la API cuando una solicitud no cumple. */
export type MotivoRechazo = { campo: string; mensaje: string }


export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly estado?: number,
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
  }
}
export class ErrorValidacion extends ErrorApi {
  constructor(
    mensaje: string,
    readonly motivos: MotivoRechazo[],
  ) {
    super(mensaje, 422)
    this.name = 'ErrorValidacion'
  }
}

/** Corta la espera: una API colgada no debe dejar la pantalla en blanco. */
const TIEMPO_LIMITE_MS = 5000

async function pedir<T>(ruta: string, señal?: AbortSignal): Promise<T> {
  if (!hayApi) throw new ErrorApi('No hay API configurada')

  let respuesta: Response
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      headers: cabeceras(),
      signal: señal ?? AbortSignal.timeout(TIEMPO_LIMITE_MS),
    })
  } catch (causa) {
    throw new ErrorApi(
      causa instanceof DOMException && causa.name === 'TimeoutError'
        ? 'La API no respondió a tiempo'
        : 'No se pudo contactar con la API',
    )
  }

  revisarSesion(respuesta)
  if (!respuesta.ok) {
    throw new ErrorApi(`La API respondió ${respuesta.status}`, respuesta.status)
  }
  return (await respuesta.json()) as T
}

async function enviar<T>(ruta: string, cuerpo: unknown): Promise<T> {
  if (!hayApi) throw new ErrorApi('No hay API configurada')

  let respuesta: Response
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: 'POST',
      headers: cabeceras({ 'content-type': 'application/json' }),
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    })
  } catch {
    throw new ErrorApi('No se pudo contactar con la API')
  }

  revisarSesion(respuesta)
  // 422 trae el detalle por campo, que el formulario sabe pintar.
  if (respuesta.status === 422) {
    const cuerpoError = (await respuesta.json()) as { error: string; motivos: MotivoRechazo[] }
    throw new ErrorValidacion(cuerpoError.error, cuerpoError.motivos)
  }
  if (!respuesta.ok) throw new ErrorApi(`La API respondió ${respuesta.status}`, respuesta.status)
  return (await respuesta.json()) as T
}

export const clienteApi = {
  listarHallazgos: (señal?: AbortSignal) =>
    pedir<RespuestaHallazgos>('/hallazgos', señal),
  resumen: (señal?: AbortSignal) => pedir<RespuestaResumen>('/resumen', señal),
  listarExcepciones: (señal?: AbortSignal) =>
    pedir<RespuestaExcepciones>('/excepciones', señal),
  crearExcepcion: (nueva: NuevaExcepcionApi) => enviar<ExcepcionApi>('/excepciones', nueva),
  listarRecursos: (señal?: AbortSignal) => pedir<RespuestaRecursos>('/recursos', señal),
  listarEvidencia: (señal?: AbortSignal) =>
    pedir<RespuestaEvidencia>('/evidencia', señal),
  iniciarSesion: (credenciales: CredencialesApi) => enviar<SesionApi>('/sesion', credenciales),
}
