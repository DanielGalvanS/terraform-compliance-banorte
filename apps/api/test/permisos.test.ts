import { describe, expect, it } from 'vitest'
import { Rol } from '../src/model/esquemas.ts'
import { PERMISOS, puede } from '../src/model/permisos.ts'

describe('permisos por rol', () => {
  it.each(Rol.options)('%s puede leer', (rol) => {
    expect(puede(rol, 'leer')).toBe(true)
  })

  it('el Auditor solo lee', () => {
    expect(PERMISOS.Auditor).toEqual(['leer'])
  })

  it('solo Aprobador y Compliance Lead deciden excepciones', () => {
    expect(Rol.options.filter((r) => puede(r, 'decidirExcepcion'))).toEqual([
      'Compliance Lead',
      'Aprobador',
    ])
  })

  it('solo Compliance Lead revoca excepciones', () => {
    expect(Rol.options.filter((r) => puede(r, 'revocarExcepcion'))).toEqual(['Compliance Lead'])
  })

  it('el Agente registra su decisión, pero no decide ni cambia estados', () => {
    expect(puede('Agente', 'registrarDecision')).toBe(true)
    expect(puede('Agente', 'decidirExcepcion')).toBe(false)
    expect(puede('Agente', 'cambiarEstadoHallazgo')).toBe(false)
  })

  it('solo el Agente registra decisiones del agente', () => {
    expect(Rol.options.filter((r) => puede(r, 'registrarDecision'))).toEqual(['Agente'])
  })

  it('el Pipeline registra hallazgos, pero no los cambia de estado', () => {
    expect(puede('Pipeline', 'registrarHallazgo')).toBe(true)
    expect(puede('Pipeline', 'cambiarEstadoHallazgo')).toBe(false)
  })
})
