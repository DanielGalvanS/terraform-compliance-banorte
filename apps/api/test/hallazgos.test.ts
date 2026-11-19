import { describe, expect, it } from 'vitest'
import { EstadoHallazgo } from '../src/model/esquemas.ts'
import { TRANSICIONES, validarCambioEstado } from '../src/model/reglasHallazgos.ts'

const COMENTARIO = 'Se asigna al equipo de red'
const estados = EstadoHallazgo.options

/** Todas las parejas (de, a) distintas, para probar la tabla completa. */
const parejas = estados.flatMap((de) => estados.filter((a) => a !== de).map((a) => [de, a] as const))

describe('reglas del estado de un hallazgo', () => {
  const validas = parejas.filter(([de, a]) => TRANSICIONES[de].includes(a))
  const invalidas = parejas.filter(([de, a]) => !TRANSICIONES[de].includes(a) && a !== 'Excepción')

  it('la tabla tiene las transiciones acordadas', () => {
    expect(validas).toEqual([
      ['Abierto', 'En remediación'],
      ['Abierto', 'Cerrado'],
      ['En remediación', 'Abierto'],
      ['En remediación', 'Cerrado'],
      ['Cerrado', 'Abierto'],
    ])
  })

  it.each(validas)('permite %s → %s', (de, a) => {
    expect(validarCambioEstado(de, a, COMENTARIO)).toEqual({ conflicto: null, motivos: [] })
  })

  it.each(invalidas)('no permite %s → %s (409)', (de, a) => {
    expect(validarCambioEstado(de, a, COMENTARIO).conflicto).not.toBeNull()
  })

  it.each(estados.filter((e) => e !== 'Excepción'))(
    'a Excepción no se llega desde %s: usa el flujo de excepciones (422)',
    (de) => {
      const r = validarCambioEstado(de, 'Excepción', COMENTARIO)
      expect(r.conflicto).toBeNull()
      expect(r.motivos.map((m) => m.campo)).toEqual(['estado'])
      expect(r.motivos[0]!.mensaje).toContain('flujo de excepciones')
    },
  )

  it.each(estados.filter((e) => e !== 'Excepción'))('mismo estado %s es conflicto', (estado) => {
    expect(validarCambioEstado(estado, estado, COMENTARIO).conflicto).toContain('ya está')
  })

  it('el comentario es obligatorio y no basta con espacios', () => {
    for (const comentario of ['', ' '.repeat(30), 'corto']) {
      const r = validarCambioEstado('Abierto', 'Cerrado', comentario)
      expect(r.motivos.map((m) => m.campo)).toEqual(['comentario'])
    }
  })

  it('acumula todos los motivos', () => {
    const r = validarCambioEstado('Abierto', 'Excepción', '')
    expect(r.motivos.map((m) => m.campo).sort()).toEqual(['comentario', 'estado'])
  })
})
