import { describe, expect, it } from 'vitest'
import {
  almacenEnMemoria,
  almacenGcs,
  EvidenciaNoDisponible,
  type AlmacenObjetos,
  type BucketGcs,
} from '../src/repositorios/almacenObjetos.ts'
import {
  evidenciaEnBucket,
  HASH_INICIAL,
  jsonCanonico,
  nombreDeEvento,
  type NuevoEvento,
} from '../src/repositorios/evidenciaRepositorio.ts'

const evento = (objetoId: string): NuevoEvento => ({
  tipo: 'hallazgo.estado',
  objetoId,
  actor: 'Roberto Silva',
  detalle: { de: 'Abierto', a: 'En remediación', comentario: 'Se asigna al equipo de red' },
})

/** Un almacén cuyas operaciones fallan, como un bucket inaccesible. */
const almacenCaido = (falla: Partial<Record<keyof AlmacenObjetos, boolean>>): AlmacenObjetos => {
  const base = almacenEnMemoria()
  const romper = <K extends keyof AlmacenObjetos>(k: K) =>
    (falla[k] ? () => Promise.reject(new Error('503 del bucket')) : base[k]) as AlmacenObjetos[K]
  return { crear: romper('crear'), listar: romper('listar'), leer: romper('leer') }
}

describe('almacén en memoria', () => {
  it('no sobrescribe un objeto que ya existe', async () => {
    const objetos = new Map<string, string>()
    const almacen = almacenEnMemoria(objetos)
    expect(await almacen.crear('a.json', 'original')).toBe('creado')
    expect(await almacen.crear('a.json', 'otro')).toBe('existe')
    expect(objetos.get('a.json')).toBe('original')
  })
})

describe('evidencia en el bucket', () => {
  it('cada evento queda como un objeto propio, con su JSON canónico', async () => {
    const objetos = new Map<string, string>()
    const registro = await evidenciaEnBucket(almacenEnMemoria(objetos))
    const primero = await registro.registrar(evento('a'))

    expect([...objetos.keys()]).toEqual(['evidencia/0000000001.json'])
    expect(objetos.get(nombreDeEvento(1))).toBe(jsonCanonico(primero))
    expect(primero.hashAnterior).toBe(HASH_INICIAL)
  })

  it('una instancia nueva reconstruye la cadena y continúa la secuencia', async () => {
    const almacen = almacenEnMemoria()
    const primera = await evidenciaEnBucket(almacen)
    await primera.registrar(evento('a'))
    const segundo = await primera.registrar(evento('b'))

    const reiniciada = await evidenciaEnBucket(almacen)
    expect((await reiniciada.listar({})).map((e) => e.objetoId)).toEqual(['b', 'a'])
    expect(await reiniciada.verificar()).toEqual({ integra: true, primerEventoAlterado: null })

    const tercero = await reiniciada.registrar(evento('c'))
    expect(tercero.secuencia).toBe(3)
    expect(tercero.hashAnterior).toBe(segundo.hash)
  })

  it('detecta un objeto alterado en el bucket aunque el índice en memoria esté bien', async () => {
    const objetos = new Map<string, string>()
    const registro = await evidenciaEnBucket(almacenEnMemoria(objetos))
    for (const id of ['a', 'b', 'c']) await registro.registrar(evento(id))

    const original = JSON.parse(objetos.get(nombreDeEvento(2))!)
    objetos.set(
      nombreDeEvento(2),
      jsonCanonico({ ...original, detalle: { ...original.detalle, comentario: 'Otro' } }),
    )

    expect(await registro.verificar()).toEqual({ integra: false, primerEventoAlterado: 2 })
  })

  it('un objeto reemplazado por algo que no es un evento también cuenta como alterado', async () => {
    const objetos = new Map<string, string>()
    const registro = await evidenciaEnBucket(almacenEnMemoria(objetos))
    for (const id of ['a', 'b']) await registro.registrar(evento(id))

    objetos.set(nombreDeEvento(2), '<html>no es evidencia</html>')
    expect(await registro.verificar()).toEqual({ integra: false, primerEventoAlterado: 2 })
  })

  it('un evento borrado del bucket se detecta por el hueco en la secuencia', async () => {
    const objetos = new Map<string, string>()
    const registro = await evidenciaEnBucket(almacenEnMemoria(objetos))
    for (const id of ['a', 'b', 'c']) await registro.registrar(evento(id))

    objetos.delete(nombreDeEvento(2))
    expect((await registro.verificar()).integra).toBe(false)
  })

  it('dos instancias no crean dos eventos con la misma secuencia', async () => {
    const almacen = almacenEnMemoria()
    // Las dos cargan la cadena vacía antes de que cualquiera escriba.
    const a = await evidenciaEnBucket(almacen)
    const b = await evidenciaEnBucket(almacen)

    const deA = await a.registrar(evento('a'))
    const deB = await b.registrar(evento('b'))

    expect(deA.secuencia).toBe(1)
    expect(deB.secuencia).toBe(2)
    expect(deB.hashAnterior).toBe(deA.hash)
    expect(await b.verificar()).toEqual({ integra: true, primerEventoAlterado: null })
  })

  it('si el bucket no acepta la escritura, el evento no se registra', async () => {
    const registro = await evidenciaEnBucket(almacenCaido({ crear: true }))
    await expect(registro.registrar(evento('a'))).rejects.toBeInstanceOf(EvidenciaNoDisponible)
    expect(await registro.listar({})).toEqual([])
  })

  it('si el bucket no responde al arrancar, no se puede crear el registro', async () => {
    await expect(evidenciaEnBucket(almacenCaido({ listar: true }))).rejects.toBeInstanceOf(
      EvidenciaNoDisponible,
    )
  })
})

describe('almacén sobre Cloud Storage', () => {
  /** Un bucket falso que registra cómo se le llamó. */
  function bucketFalso(alGuardar?: () => Promise<unknown>) {
    const guardados: { nombre: string; opciones: unknown }[] = []
    const bucket: BucketGcs = {
      file: (nombre) => ({
        save: async (_contenido, opciones) => {
          guardados.push({ nombre, opciones })
          return alGuardar?.()
        },
        download: async () => [Buffer.from(`contenido de ${nombre}`, 'utf8')],
      }),
      getFiles: async () => [[{ name: 'evidencia/0000000002.json' }, { name: 'evidencia/0000000001.json' }]],
    }
    return { bucket, guardados }
  }

  it('crea con ifGenerationMatch 0: solo si el objeto no existe', async () => {
    const { bucket, guardados } = bucketFalso()
    expect(await almacenGcs('b', bucket).crear('evidencia/0000000001.json', '{}')).toBe('creado')
    expect(guardados[0]!.opciones).toMatchObject({
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
    })
  })

  it('un 412 del bucket significa que ya existía: no se sobrescribió', async () => {
    const { bucket } = bucketFalso(() => Promise.reject(Object.assign(new Error('x'), { code: 412 })))
    expect(await almacenGcs('b', bucket).crear('a.json', '{}')).toBe('existe')
  })

  it('cualquier otro error se propaga', async () => {
    const { bucket } = bucketFalso(() => Promise.reject(Object.assign(new Error('x'), { code: 403 })))
    await expect(almacenGcs('b', bucket).crear('a.json', '{}')).rejects.toThrow('x')
  })

  it('lista en orden y lee como texto', async () => {
    const { bucket } = bucketFalso()
    const almacen = almacenGcs('b', bucket)
    expect(await almacen.listar('evidencia/')).toEqual([
      'evidencia/0000000001.json',
      'evidencia/0000000002.json',
    ])
    expect(await almacen.leer('evidencia/0000000001.json')).toBe(
      'contenido de evidencia/0000000001.json',
    )
  })
})
