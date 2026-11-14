import { randomUUID } from 'node:crypto'
import type { FiltroHallazgos, Hallazgo, NuevoHallazgo } from '../model/esquemas.ts'

/**
 * Acceso a hallazgos.
 *
 * La implementación en memoria permite levantar la API sin base de datos,
 * que es lo que hay mientras no exista el proyecto de GCP. Cuando llegue,
 * se añade una implementación con Drizzle sobre el esquema de `db/esquema.ts`
 * y nadie más se entera: las rutas dependen de esta interfaz.
 */
export type HallazgosRepositorio = {
  listar(filtro: FiltroHallazgos): Promise<Hallazgo[]>
  obtener(id: string): Promise<Hallazgo | null>
  /**
   * Crea un hallazgo. `clave` es la Idempotency-Key: si ya se registró uno
   * con la misma, se devuelve aquel en lugar de duplicarlo. El pipeline
   * reintenta, y un reintento no debe inflar el conteo de incumplimientos.
   */
  crear(nuevo: NuevoHallazgo, clave?: string): Promise<{ hallazgo: Hallazgo; yaExistia: boolean }>
}

export function repositorioEnMemoria(semilla: Hallazgo[] = []): HallazgosRepositorio {
  const hallazgos = new Map<string, Hallazgo>(semilla.map((h) => [h.id, h]))
  const porClave = new Map<string, string>()

  return {
    async listar(filtro) {
      return [...hallazgos.values()].filter(
        (h) =>
          (filtro.severidad === undefined || h.severidad === filtro.severidad) &&
          (filtro.ambiente === undefined || h.ambiente === filtro.ambiente) &&
          (filtro.estado === undefined || h.estado === filtro.estado) &&
          (filtro.control === undefined || h.control === filtro.control),
      )
    },

    async obtener(id) {
      return hallazgos.get(id) ?? null
    },

    async crear(nuevo, clave) {
      if (clave !== undefined) {
        const existente = porClave.get(clave)
        if (existente !== undefined) {
          return { hallazgo: hallazgos.get(existente)!, yaExistia: true }
        }
      }

      const hallazgo: Hallazgo = {
        id: randomUUID(),
        control: nuevo.control,
        titulo: nuevo.titulo,
        recurso: nuevo.recurso,
        severidad: nuevo.severidad,
        ambiente: nuevo.ambiente,
        origen: nuevo.origen,
        estado: 'Abierto',
        mensaje: nuevo.mensaje,
        detectadoEn: new Date().toISOString(),
      }
      hallazgos.set(hallazgo.id, hallazgo)
      if (clave !== undefined) porClave.set(clave, hallazgo.id)
      return { hallazgo, yaExistia: false }
    },
  }
}
