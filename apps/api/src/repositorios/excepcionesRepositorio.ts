import { randomUUID } from 'node:crypto'
import type { EstadoExcepcion, Excepcion, FiltroExcepciones } from '../model/esquemas.ts'
import { estadoVigente } from '../model/reglasExcepciones.ts'

/** Lo que el repositorio guarda; el estado mostrado se deriva al leer. */
export type ExcepcionGuardada = Omit<Excepcion, 'estado' | 'controlNombre' | 'marco' | 'severidad'> & {
  estadoGuardado: EstadoExcepcion
}

export type DatosDeControl = {
  nombre: string
  marco: string
  severidad: Excepcion['severidad']
}

export type ExcepcionesRepositorio = {
  listar(filtro: FiltroExcepciones): Promise<ExcepcionGuardada[]>
  crear(datos: Omit<ExcepcionGuardada, 'id' | 'codigo' | 'estadoGuardado'>): Promise<ExcepcionGuardada>
}

export function excepcionesEnMemoria(semilla: ExcepcionGuardada[] = []): ExcepcionesRepositorio {
  const excepciones = [...semilla]
  // Continúa la numeración de la semilla en vez de empezar de cero.
  let siguiente =
    excepciones.reduce((mayor, e) => Math.max(mayor, Number(e.codigo.split('-')[1] ?? 0)), 1047) + 1

  return {
    async listar(filtro) {
      return excepciones.filter(
        (e) =>
          (filtro.ambiente === undefined || e.ambiente === filtro.ambiente) &&
          (filtro.control === undefined || e.control === filtro.control) &&
          (filtro.estado === undefined ||
            estadoVigente(e.estadoGuardado, e.venceEl) === filtro.estado),
      )
    },

    async crear(datos) {
      const excepcion: ExcepcionGuardada = {
        ...datos,
        id: randomUUID(),
        codigo: `EXC-${siguiente++}`,
        // Nunca nace activa: nada se exceptúa sin aprobación humana.
        estadoGuardado: 'Pendiente',
      }
      excepciones.unshift(excepcion)
      return excepcion
    },
  }
}
