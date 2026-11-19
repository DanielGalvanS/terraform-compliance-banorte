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

export type Decision = {
  estado: 'Activa' | 'Rechazada'
  decididaPor: string
  comentario: string
  decididaEn: string
}

export type ExcepcionesRepositorio = {
  listar(filtro: FiltroExcepciones): Promise<ExcepcionGuardada[]>
  obtener(id: string): Promise<ExcepcionGuardada | null>
  crear(
    datos: Omit<
      ExcepcionGuardada,
      'id' | 'codigo' | 'estadoGuardado' | 'comentarioDecision' | 'decididaEn'
    >,
  ): Promise<ExcepcionGuardada>
  /**
   * Registra la decisión. Solo cambia el estado: las reglas (quién puede
   * decidir y cuándo) ya las validó `validarDecision` antes de llamar. Repetirlas
   * aquí sería tener dos versiones que tarde o temprano discrepan.
   */
  decidir(id: string, decision: Decision): Promise<ExcepcionGuardada | null>
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

    async obtener(id) {
      return excepciones.find((e) => e.id === id) ?? null
    },

    async crear(datos) {
      const excepcion: ExcepcionGuardada = {
        ...datos,
        comentarioDecision: null,
        decididaEn: null,
        id: randomUUID(),
        codigo: `EXC-${siguiente++}`,
        // Nunca nace activa: nada se exceptúa sin aprobación humana.
        estadoGuardado: 'Pendiente',
      }
      excepciones.unshift(excepcion)
      return excepcion
    },

    async decidir(id, { estado, decididaPor, comentario, decididaEn }) {
      const excepcion = excepciones.find((e) => e.id === id)
      if (excepcion === undefined) return null
      excepcion.estadoGuardado = estado
      // `aprobadaPor` guarda a quien decidió también al rechazar: es la columna
      // que ya existe en `db/esquema.ts`, y el estado dice en qué sentido.
      excepcion.aprobadaPor = decididaPor
      excepcion.comentarioDecision = comentario
      excepcion.decididaEn = decididaEn
      return excepcion
    },
  }
}
