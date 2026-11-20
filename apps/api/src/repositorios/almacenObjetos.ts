import { Storage } from '@google-cloud/storage'

/**
 * Un almacén de objetos de solo creación: se puede crear, listar y leer, pero
 * no hay forma de sobrescribir ni de borrar. Es la forma que tiene la evidencia
 * en el bucket con retención de `infra/modules/logging`.
 */
export type AlmacenObjetos = {
  /** Solo crea. Responde 'existe' si ya hay un objeto con ese nombre: nunca lo sobrescribe. */
  crear(nombre: string, contenido: string): Promise<'creado' | 'existe'>
  /** Nombres con ese prefijo, en orden alfabético. */
  listar(prefijo: string): Promise<string[]>
  leer(nombre: string): Promise<string>
}

/** El almacén no respondió: no se puede garantizar que la evidencia quedó escrita. */
export class EvidenciaNoDisponible extends Error {
  constructor(causa: unknown) {
    super('No se pudo registrar la evidencia', { cause: causa })
    this.name = 'EvidenciaNoDisponible'
  }
}

/**
 * Almacén en memoria, para las pruebas. Imita la precondición del bucket: un
 * nombre que ya existe no se sobrescribe.
 *
 * `objetos` es el almacén mismo. Las pruebas lo pasan para poder alterar un
 * objeto «por fuera», como haría alguien con acceso al bucket, y comprobar
 * que la verificación lo detecta.
 */
export function almacenEnMemoria(objetos: Map<string, string> = new Map()): AlmacenObjetos {
  return {
    async crear(nombre, contenido) {
      if (objetos.has(nombre)) return 'existe'
      objetos.set(nombre, contenido)
      return 'creado'
    },
    async listar(prefijo) {
      return [...objetos.keys()].filter((n) => n.startsWith(prefijo)).sort()
    },
    async leer(nombre) {
      const contenido = objetos.get(nombre)
      if (contenido === undefined) throw new Error(`No existe ${nombre}`)
      return contenido
    },
  }
}

/** Lo mínimo del cliente de Cloud Storage que usa el almacén; las pruebas lo sustituyen. */
export type BucketGcs = {
  file(nombre: string): {
    save(
      contenido: string,
      opciones: {
        resumable: boolean
        contentType: string
        preconditionOpts: { ifGenerationMatch: number }
      },
    ): Promise<unknown>
    download(): Promise<[Buffer]>
  }
  getFiles(opciones: { prefix: string }): Promise<[{ name: string }[], ...unknown[]]>
}

/** GCS responde 412 cuando falla una precondición: aquí, que el objeto ya existía. */
function esPrecondicionFallida(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 412
  )
}

/**
 * Almacén sobre un bucket de Cloud Storage.
 *
 * Cada objeto se crea con `ifGenerationMatch: 0`, que en GCS significa «solo
 * si no existe». Así ni la propia API puede reescribir un evento, aunque
 * tuviera un error: el bucket rechaza la escritura con 412. Lo demás lo hacen
 * el rol `storage.objectCreator`, que no permite borrar, y la retención del
 * bucket, que impide borrar incluso a un administrador.
 *
 * Se autentica con las credenciales por defecto de GCP: la cuenta `app-api`
 * en Cloud Run. No hay llaves en el repositorio.
 */
export function almacenGcs(
  nombreBucket: string,
  bucket: BucketGcs = new Storage().bucket(nombreBucket) as unknown as BucketGcs,
): AlmacenObjetos {
  return {
    async crear(nombre, contenido) {
      try {
        await bucket.file(nombre).save(contenido, {
          // Un objeto chico: la subida simple es una sola petición, y la
          // precondición se evalúa en ella.
          resumable: false,
          contentType: 'application/json',
          preconditionOpts: { ifGenerationMatch: 0 },
        })
        return 'creado'
      } catch (error) {
        if (esPrecondicionFallida(error)) return 'existe'
        throw error
      }
    },
    async listar(prefijo) {
      const [archivos] = await bucket.getFiles({ prefix: prefijo })
      return archivos.map((a) => a.name).sort()
    },
    async leer(nombre) {
      const [contenido] = await bucket.file(nombre).download()
      return contenido.toString('utf8')
    },
  }
}
