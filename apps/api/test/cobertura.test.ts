import { describe, expect, it } from 'vitest'
import type { Hallazgo } from '../src/model/esquemas.ts'
import type { Catalogo } from '../src/repositorios/catalogoRepositorio.ts'
import { calcularCobertura } from '../src/rutas/resumen.ts'

/** Catálogo mínimo: dos marcos y tres controles repartidos entre ellos. */
const catalogo: Catalogo = {
  version: '0.0.1',
  marcos: [
    { clave: 'a', nombre: 'Marco A', nombreCorto: 'A' },
    { clave: 'b', nombre: 'Marco B', nombreCorto: 'B' },
    { clave: 'c', nombre: 'Marco C sin controles', nombreCorto: 'C' },
  ],
  controles: [
    {
      codigo: 'CO-1',
      titulo: 'Uno',
      descripcion: '',
      severidad: 'Crítica',
      mapeo: [{ marco: 'A', referencia: '1', titulo: '', porValidar: false }],
    },
    {
      codigo: 'CO-2',
      titulo: 'Dos',
      descripcion: '',
      severidad: 'Alta',
      mapeo: [{ marco: 'A', referencia: '2', titulo: '', porValidar: false }],
    },
    {
      codigo: 'CO-3',
      titulo: 'Tres',
      descripcion: '',
      severidad: 'Media',
      // Un control puede responder a dos marcos a la vez.
      mapeo: [
        { marco: 'A', referencia: '3', titulo: '', porValidar: false },
        { marco: 'B', referencia: '3', titulo: '', porValidar: false },
      ],
    },
  ],
}

function hallazgo(control: string | null, estado: Hallazgo['estado']): Hallazgo {
  return {
    id: crypto.randomUUID(),
    control,
    titulo: 'x',
    recurso: 'x',
    severidad: 'Alta',
    ambiente: 'Dev',
    origen: 'Plan',
    estado,
    mensaje: 'x',
    detectadoEn: new Date().toISOString(),
  }
}

const de = (cobertura: ReturnType<typeof calcularCobertura>, marco: string) =>
  cobertura.find((c) => c.marco === marco)!

describe('cobertura por marco', () => {
  it('sin hallazgos, todo conforme', () => {
    const cobertura = calcularCobertura(catalogo, [])
    expect(de(cobertura, 'A').porcentaje).toBe(100)
    expect(de(cobertura, 'B').porcentaje).toBe(100)
  })

  it('un hallazgo abierto baja solo el marco de su control', () => {
    const cobertura = calcularCobertura(catalogo, [hallazgo('CO-1', 'Abierto')])
    // A tiene tres controles y uno incumple.
    expect(de(cobertura, 'A')).toMatchObject({ controles: 3, conformes: 2, porcentaje: 66.7 })
    expect(de(cobertura, 'B').porcentaje).toBe(100)
  })

  it('un control compartido afecta a los dos marcos', () => {
    const cobertura = calcularCobertura(catalogo, [hallazgo('CO-3', 'Abierto')])
    expect(de(cobertura, 'A').porcentaje).toBe(66.7)
    expect(de(cobertura, 'B').porcentaje).toBe(0)
  })

  it('en remediación sigue contando como incumplimiento', () => {
    const cobertura = calcularCobertura(catalogo, [hallazgo('CO-1', 'En remediación')])
    expect(de(cobertura, 'A').conformes).toBe(2)
  })

  it('un hallazgo cerrado no resta', () => {
    const cobertura = calcularCobertura(catalogo, [hallazgo('CO-1', 'Cerrado')])
    expect(de(cobertura, 'A').porcentaje).toBe(100)
  })

  it('un hallazgo con excepción vigente no resta', () => {
    const cobertura = calcularCobertura(catalogo, [hallazgo('CO-1', 'Excepción')])
    expect(de(cobertura, 'A').porcentaje).toBe(100)
  })

  it('varios hallazgos del mismo control cuentan una vez', () => {
    const cobertura = calcularCobertura(catalogo, [
      hallazgo('CO-1', 'Abierto'),
      hallazgo('CO-1', 'Abierto'),
    ])
    expect(de(cobertura, 'A').conformes).toBe(2)
  })

  it('un hallazgo sin control no afecta a ningún marco', () => {
    const cobertura = calcularCobertura(catalogo, [hallazgo(null, 'Abierto')])
    expect(de(cobertura, 'A').porcentaje).toBe(100)
  })

  it('un marco sin controles da 100, no una división por cero', () => {
    const cobertura = calcularCobertura(catalogo, [])
    expect(de(cobertura, 'C')).toMatchObject({ controles: 0, porcentaje: 100 })
  })
})
