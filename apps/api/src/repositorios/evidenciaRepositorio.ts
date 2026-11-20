import { createHash, randomUUID } from 'node:crypto'
import { EventoEvidencia, type TipoEvento } from '../model/esquemas.ts'
import { EvidenciaNoDisponible, type AlmacenObjetos } from './almacenObjetos.ts'

/** El `hashAnterior` del primer evento: no hay nada antes que encadenar. */
export const HASH_INICIAL = `sha256:${'0'.repeat(64)}`

export type NuevoEvento = Omit<
  EventoEvidencia,
  'id' | 'secuencia' | 'hashAnterior' | 'hash' | 'registradoEn'
>

/**
 * Registro de evidencia: decisiones y cambios de estado que un auditor va a
 * querer reconstruir.
 *
 * Solo se agrega. No hay métodos para editar ni borrar a propósito: la
 * evidencia que se puede corregir después no prueba nada.
 */
export type EvidenciaRepositorio = {
  registrar(evento: NuevoEvento): Promise<EventoEvidencia>
  /** Del más reciente al más antiguo. */
  listar(filtro: { tipo?: TipoEvento; objetoId?: string }): Promise<EventoEvidencia[]>
  verificar(): Promise<ResultadoVerificacion>
}

/**
 * JSON con las claves ordenadas. Sin esto, el mismo evento con las claves en
 * otro orden daría otro hash y la verificación fallaría sin que nadie lo
 * hubiera tocado.
 */
export function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`
  if (valor !== null && typeof valor === 'object') {
    const claves = Object.keys(valor).sort()
    return `{${claves
      .map((c) => `${JSON.stringify(c)}:${jsonCanonico((valor as Record<string, unknown>)[c])}`)
      .join(',')}}`
  }
  return JSON.stringify(valor)
}

export function calcularHash(evento: Omit<EventoEvidencia, 'hash'>): string {
  const digest = createHash('sha256')
    .update(evento.hashAnterior + jsonCanonico(evento))
    .digest('hex')
  return `sha256:${digest}`
}

/**
 * Implementación en memoria.
 *
 * En memoria esto no es inmutable de verdad: quien tenga el proceso puede
 * reescribir el arreglo. La inmutabilidad real la da el bucket con retención
 * del módulo `infra/modules/logging`. Esto deja la estructura lista y hace que
 * una alteración sea detectable.
 *
 * `eventos` es el almacén mismo, no una copia. Las pruebas pasan su propio
 * arreglo para poder alterar un evento y comprobar que `verificar()` lo
 * detecta; la aplicación no lo pasa.
 */
export function evidenciaEnMemoria(eventos: EventoEvidencia[] = []): EvidenciaRepositorio {
  return {
    async registrar(nuevo) {
      const evento = encadenar(nuevo, eventos.at(-1))
      eventos.push(evento)
      return evento
    },

    async listar(filtro) {
      return eventos
        .filter(
          (e) =>
            (filtro.tipo === undefined || e.tipo === filtro.tipo) &&
            (filtro.objetoId === undefined || e.objetoId === filtro.objetoId),
        )
        .reverse()
    },

    async verificar() {
      return verificarCadena(eventos)
    },
  }
}

export type ResultadoVerificacion = { integra: boolean; primerEventoAlterado: number | null }

/**
 * Revisa una cadena completa, en orden de secuencia.
 *
 * Es la única versión de la regla: la usan la implementación en memoria y la
 * del bucket. Se revisan el enlace con el anterior, el contenido y que no
 * falte ningún evento: borrar uno deja un hueco en la secuencia.
 */
export function verificarCadena(eventos: readonly EventoEvidencia[]): ResultadoVerificacion {
  let hashEsperado = HASH_INICIAL
  for (const [indice, evento] of eventos.entries()) {
    const { hash, ...sinHash } = evento
    if (
      evento.secuencia !== indice + 1 ||
      evento.hashAnterior !== hashEsperado ||
      hash !== calcularHash(sinHash)
    ) {
      return { integra: false, primerEventoAlterado: evento.secuencia }
    }
    hashEsperado = hash
  }
  return { integra: true, primerEventoAlterado: null }
}

const PREFIJO_EVIDENCIA = 'evidencia/'

/**
 * Nombre del objeto de un evento. Con la secuencia rellenada a 10 dígitos, el
 * orden alfabético del bucket es el orden de la cadena.
 */
export function nombreDeEvento(secuencia: number): string {
  return `${PREFIJO_EVIDENCIA}${String(secuencia).padStart(10, '0')}.json`
}

/** Arma el siguiente evento de la cadena, ya con su hash. */
function encadenar(nuevo: NuevoEvento, anterior: EventoEvidencia | undefined): EventoEvidencia {
  const sinHash: Omit<EventoEvidencia, 'hash'> = {
    ...nuevo,
    id: randomUUID(),
    secuencia: (anterior?.secuencia ?? 0) + 1,
    registradoEn: new Date().toISOString(),
    hashAnterior: anterior?.hash ?? HASH_INICIAL,
  }
  return { ...sinHash, hash: calcularHash(sinHash) }
}

/**
 * Lee la cadena completa del almacén. Un objeto que ya no es un evento válido
 * (alguien lo reemplazó por otra cosa) no rompe la lectura: se reporta como el
 * primer evento alterado, igual que un hash que no coincide.
 */
async function leerCadena(
  almacen: AlmacenObjetos,
): Promise<{ eventos: EventoEvidencia[]; ilegible: number | null }> {
  const nombres = await almacen.listar(PREFIJO_EVIDENCIA)
  const contenidos = await Promise.all(nombres.map((n) => almacen.leer(n)))
  const eventos: EventoEvidencia[] = []
  for (const contenido of contenidos) {
    let evento: EventoEvidencia
    try {
      evento = EventoEvidencia.parse(JSON.parse(contenido))
    } catch {
      return { eventos, ilegible: eventos.length + 1 }
    }
    eventos.push(evento)
  }
  return { eventos, ilegible: null }
}

/**
 * Registro de evidencia sobre un almacén de solo creación: el bucket con
 * retención en GCP, o uno en memoria en las pruebas.
 *
 * - Cada evento es un objeto propio, escrito **antes** de darlo por
 *   registrado. Si el almacén falla, lanza `EvidenciaNoDisponible` y el evento
 *   no existe.
 * - Dos instancias de la API pueden intentar la misma secuencia. El almacén
 *   solo deja crear el nombre una vez; la que pierde recarga la cadena y
 *   reintenta con la siguiente.
 * - `listar` usa un índice en memoria, cargado al arrancar.
 * - `verificar` vuelve a leer el almacén: detecta un objeto alterado aunque el
 *   índice esté bien. Son tantas lecturas como eventos; a la escala de este
 *   proyecto está bien, y con volumen real habría que verificar por tramos.
 */
export async function evidenciaEnBucket(almacen: AlmacenObjetos): Promise<EvidenciaRepositorio> {
  const recargar = async () => {
    try {
      return (await leerCadena(almacen)).eventos
    } catch (error) {
      throw new EvidenciaNoDisponible(error)
    }
  }

  let eventos = await recargar()

  return {
    async registrar(nuevo) {
      // Dos intentos: el segundo, después de recargar, cubre que otra
      // instancia haya escrito esa secuencia entre tanto.
      for (let intento = 0; intento < 2; intento++) {
        const evento = encadenar(nuevo, eventos.at(-1))
        let resultado: 'creado' | 'existe'
        try {
          resultado = await almacen.crear(nombreDeEvento(evento.secuencia), jsonCanonico(evento))
        } catch (error) {
          throw new EvidenciaNoDisponible(error)
        }
        if (resultado === 'creado') {
          eventos = [...eventos, evento]
          return evento
        }
        eventos = await recargar()
      }
      throw new EvidenciaNoDisponible(new Error('La secuencia siguió ocupada después de recargar'))
    },

    async listar(filtro) {
      return eventos
        .filter(
          (e) =>
            (filtro.tipo === undefined || e.tipo === filtro.tipo) &&
            (filtro.objetoId === undefined || e.objetoId === filtro.objetoId),
        )
        .reverse()
    },

    async verificar() {
      let cadena: Awaited<ReturnType<typeof leerCadena>>
      try {
        cadena = await leerCadena(almacen)
      } catch (error) {
        throw new EvidenciaNoDisponible(error)
      }
      if (cadena.ilegible !== null) {
        return { integra: false, primerEventoAlterado: cadena.ilegible }
      }
      return verificarCadena(cadena.eventos)
    },
  }
}
