import { createHash, randomUUID } from 'node:crypto'
import type { EventoEvidencia, TipoEvento } from '../model/esquemas.ts'

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
  verificar(): Promise<{ integra: boolean; primerEventoAlterado: number | null }>
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
      const anterior = eventos.at(-1)
      const sinHash: Omit<EventoEvidencia, 'hash'> = {
        ...nuevo,
        id: randomUUID(),
        secuencia: (anterior?.secuencia ?? 0) + 1,
        registradoEn: new Date().toISOString(),
        hashAnterior: anterior?.hash ?? HASH_INICIAL,
      }
      const evento: EventoEvidencia = { ...sinHash, hash: calcularHash(sinHash) }
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
      let hashEsperado = HASH_INICIAL
      for (const [indice, evento] of eventos.entries()) {
        const { hash, ...sinHash } = evento
        // Se revisan el enlace con el anterior, el contenido y que no falte
        // ningún evento: borrar uno deja un hueco en la secuencia.
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
    },
  }
}
