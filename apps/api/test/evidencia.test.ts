import { describe, expect, it } from 'vitest'
import { construirApp, PREFIJO } from '../src/app.ts'
import { cargarConfig } from '../src/config.ts'
import type { EventoEvidencia } from '../src/model/esquemas.ts'
import {
  calcularHash,
  evidenciaEnMemoria,
  HASH_INICIAL,
  jsonCanonico,
  type NuevoEvento,
} from '../src/repositorios/evidenciaRepositorio.ts'

const evento = (objetoId: string): NuevoEvento => ({
  tipo: 'hallazgo.estado',
  objetoId,
  actor: 'Roberto Silva',
  detalle: { de: 'Abierto', a: 'En remediación', comentario: 'Se asigna al equipo de red' },
})

/** Un registro con tres eventos y acceso a su almacén para poder alterarlo. */
async function registroConTres() {
  const almacen: EventoEvidencia[] = []
  const registro = evidenciaEnMemoria(almacen)
  for (const id of ['a', 'b', 'c']) await registro.registrar(evento(id))
  return { almacen, registro }
}

describe('registro de evidencia', () => {
  it('el primero se encadena al hash de ceros', async () => {
    const primero = await evidenciaEnMemoria().registrar(evento('a'))
    expect(primero.secuencia).toBe(1)
    expect(primero.hashAnterior).toBe(HASH_INICIAL)
    expect(primero.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('cada evento guarda el hash del anterior', async () => {
    const { almacen } = await registroConTres()
    expect(almacen[1]!.hashAnterior).toBe(almacen[0]!.hash)
    expect(almacen[2]!.hashAnterior).toBe(almacen[1]!.hash)
    expect(almacen.map((e) => e.secuencia)).toEqual([1, 2, 3])
  })

  it('sin cambios, la cadena está íntegra', async () => {
    const { registro } = await registroConTres()
    expect(await registro.verificar()).toEqual({ integra: true, primerEventoAlterado: null })
  })

  it('detecta un evento intermedio alterado', async () => {
    const { almacen, registro } = await registroConTres()
    almacen[1]!.detalle = { ...almacen[1]!.detalle, comentario: 'Otro comentario' }
    expect(await registro.verificar()).toEqual({ integra: false, primerEventoAlterado: 2 })
  })

  it('detecta un evento borrado', async () => {
    const { almacen, registro } = await registroConTres()
    almacen.splice(1, 1)
    expect((await registro.verificar()).integra).toBe(false)
  })

  it('el mismo evento con las claves en otro orden da el mismo hash', () => {
    const base: Omit<EventoEvidencia, 'hash'> = {
      id: '0b6d8f1e-2a4c-4e8b-9f3d-1c2b3a4d5e6f',
      secuencia: 1,
      tipo: 'excepcion.aprobada',
      objetoId: 'x',
      actor: 'Roberto Silva',
      detalle: { codigo: 'EXC-1048', comentario: 'Riesgo aceptado' },
      registradoEn: '2026-11-14T12:00:00.000Z',
      hashAnterior: HASH_INICIAL,
    }
    const desordenado = Object.fromEntries(Object.entries(base).reverse()) as typeof base
    desordenado.detalle = { comentario: 'Riesgo aceptado', codigo: 'EXC-1048' }
    expect(jsonCanonico(desordenado)).toBe(jsonCanonico(base))
    expect(calcularHash(desordenado)).toBe(calcularHash(base))
  })

  it('lista del más reciente al más antiguo y filtra', async () => {
    const { registro } = await registroConTres()
    expect((await registro.listar({})).map((e) => e.objetoId)).toEqual(['c', 'b', 'a'])
    expect((await registro.listar({ objetoId: 'b' })).map((e) => e.objetoId)).toEqual(['b'])
  })
})

describe('ruta de evidencia', () => {
  it('trae la aprobación y el cambio de estado, el más reciente primero', async () => {
    const app = await construirApp({ config: cargarConfig({ NIVEL_LOG: 'fatal' }) })

    const excepcion = (
      await app.inject({
        method: 'POST',
        url: `${PREFIJO}/excepciones`,
        payload: {
          control: 'CO-NET-01',
          recurso: 'google_compute_firewall.allow_ssh',
          ambiente: 'Prod',
          justificacion: 'Ventana de migración coordinada con el equipo de seguridad.',
          venceEl: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
          aprobador: 'Roberto Silva',
          solicitante: 'Carlos Vega',
        },
      })
    ).json()
    await app.inject({
      method: 'POST',
      url: `${PREFIJO}/excepciones/${excepcion.id}/aprobar`,
      payload: { aprobadaPor: 'Roberto Silva', comentario: 'Riesgo aceptado hasta la ventana' },
    })

    const hallazgo = (
      await app.inject({ method: 'GET', url: `${PREFIJO}/hallazgos?estado=Abierto` })
    ).json().hallazgos[0]
    await app.inject({
      method: 'PATCH',
      url: `${PREFIJO}/hallazgos/${hallazgo.id}/estado`,
      payload: { estado: 'En remediación', comentario: 'Asignado a red', cambiadoPor: 'Ana Martínez' },
    })

    const todo = (await app.inject({ method: 'GET', url: `${PREFIJO}/evidencia` })).json()
    expect(todo.integra).toBe(true)
    expect(todo.eventos.map((e: EventoEvidencia) => e.tipo)).toEqual([
      'hallazgo.estado',
      'excepcion.aprobada',
    ])
    expect(todo.eventos[0].detalle).toEqual({
      de: 'Abierto',
      a: 'En remediación',
      comentario: 'Asignado a red',
    })

    const filtrado = (
      await app.inject({ method: 'GET', url: `${PREFIJO}/evidencia?objetoId=${excepcion.id}` })
    ).json()
    expect(filtrado.eventos).toHaveLength(1)
    expect(filtrado.eventos[0].objetoId).toBe(excepcion.id)

    await app.close()
  })
})
