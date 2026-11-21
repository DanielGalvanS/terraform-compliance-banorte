import type { FiltroHallazgos, Hallazgo, HallazgoGuardado } from '../model/esquemas.ts'
import { estadoMostrado, excepcionQueCubre } from '../model/reglasVigencia.ts'
import type {
  ExcepcionesRepositorio,
  ExcepcionGuardada,
} from '../repositorios/excepcionesRepositorio.ts'
import type { HallazgosRepositorio } from '../repositorios/hallazgosRepositorio.ts'

/**
 * Hallazgos tal como se muestran: con el estado derivado de las excepciones
 * vigentes. Lo usan todas las rutas que leen hallazgos (lista, detalle,
 * resumen, inventario), para que ninguna cuente distinto.
 */
export function completarHallazgo(
  hallazgo: HallazgoGuardado,
  activas: readonly ExcepcionGuardada[],
  ahora: Date = new Date(),
): Hallazgo {
  const cubre = excepcionQueCubre(hallazgo, activas, ahora)
  const estado = estadoMostrado(hallazgo.estado, cubre !== null)
  return {
    ...hallazgo,
    estado,
    // Solo se enlaza cuando de verdad cambia lo que se muestra: un hallazgo
    // cerrado no está «cubierto», ya no hay nada que exceptuar.
    excepcion:
      estado === 'Excepción' && cubre !== null
        ? { id: cubre.id, codigo: cubre.codigo, venceEl: cubre.venceEl }
        : null,
  }
}

export async function excepcionesActivas(excepciones: ExcepcionesRepositorio) {
  return excepciones.listar({ estado: 'Activa' })
}

/**
 * Lista de hallazgos con el estado mostrado. El filtro por estado se aplica
 * después de derivarlo: filtrar por el guardado devolvería como «Abierto» un
 * hallazgo que la pantalla muestra como Excepción.
 */
export async function listarHallazgos(
  hallazgos: HallazgosRepositorio,
  excepciones: ExcepcionesRepositorio,
  filtro: FiltroHallazgos = {},
): Promise<Hallazgo[]> {
  const { estado, ...resto } = filtro
  const [guardados, activas] = await Promise.all([
    hallazgos.listar(resto),
    excepcionesActivas(excepciones),
  ])
  const completos = guardados.map((h) => completarHallazgo(h, activas))
  return estado === undefined ? completos : completos.filter((h) => h.estado === estado)
}

export async function obtenerHallazgo(
  hallazgos: HallazgosRepositorio,
  excepciones: ExcepcionesRepositorio,
  id: string,
): Promise<Hallazgo | null> {
  const [guardado, activas] = await Promise.all([
    hallazgos.obtener(id),
    excepcionesActivas(excepciones),
  ])
  return guardado === null ? null : completarHallazgo(guardado, activas)
}
