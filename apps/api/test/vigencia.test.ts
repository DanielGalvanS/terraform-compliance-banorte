import { describe, expect, it } from 'vitest'
import {
  cubre,
  DIAS_AVISO_VENCIMIENTO,
  diasRestantes,
  estadoMostrado,
  excepcionQueCubre,
  porVencer,
  type ExcepcionVigencia,
  type HallazgoVigencia,
} from '../src/model/reglasVigencia.ts'

const AHORA = new Date('2026-11-14T12:00:00Z')
const enDias = (dias: number) =>
  new Date(AHORA.getTime() + dias * 86_400_000).toISOString().slice(0, 10)

const excepcion = (extra: Partial<ExcepcionVigencia> = {}): ExcepcionVigencia => ({
  id: 'e1',
  codigo: 'EXC-1',
  control: 'CO-NET-01',
  recurso: 'google_compute_firewall.allow_ssh',
  ambiente: 'Prod',
  estadoGuardado: 'Activa',
  venceEl: enDias(30),
  ...extra,
})

const hallazgo = (extra: Partial<HallazgoVigencia> = {}): HallazgoVigencia => ({
  control: 'CO-NET-01',
  recurso: 'google_compute_firewall.allow_ssh',
  ambiente: 'Prod',
  estado: 'Abierto',
  ...extra,
})

describe('días restantes y por vencer', () => {
  it('una activa cuenta los días hasta su vencimiento', () => {
    expect(diasRestantes(excepcion({ venceEl: enDias(12) }), AHORA)).toBe(12)
  })

  it('una pendiente también', () => {
    expect(diasRestantes(excepcion({ estadoGuardado: 'Pendiente', venceEl: enDias(3) }), AHORA)).toBe(3)
  })

  it.each(['Rechazada', 'Revocada'] as const)('una %s no tiene cuenta regresiva', (estadoGuardado) => {
    expect(diasRestantes(excepcion({ estadoGuardado }), AHORA)).toBeNull()
  })

  it('una vencida tampoco', () => {
    expect(diasRestantes(excepcion({ venceEl: enDias(-1) }), AHORA)).toBeNull()
  })

  it(`está por vencer a ${DIAS_AVISO_VENCIMIENTO} días, no a uno más`, () => {
    expect(porVencer(excepcion({ venceEl: enDias(DIAS_AVISO_VENCIMIENTO) }), AHORA)).toBe(true)
    expect(porVencer(excepcion({ venceEl: enDias(DIAS_AVISO_VENCIMIENTO + 1) }), AHORA)).toBe(false)
  })

  it('una que vence hoy sigue activa y está por vencer', () => {
    expect(porVencer(excepcion({ venceEl: enDias(0) }), AHORA)).toBe(true)
  })

  it('una pendiente no está «por vencer»: aún no protege nada', () => {
    expect(porVencer(excepcion({ estadoGuardado: 'Pendiente', venceEl: enDias(1) }), AHORA)).toBe(false)
  })
})

describe('qué cubre una excepción', () => {
  it('cubre el mismo control, recurso y ambiente', () => {
    expect(cubre(excepcion(), hallazgo())).toBe(true)
  })

  it('cubre la dirección con módulo del mismo recurso', () => {
    expect(cubre(excepcion(), hallazgo({ recurso: 'module.fw.google_compute_firewall.allow_ssh' }))).toBe(true)
  })

  it('no cubre otro ambiente: aceptarlo en Dev no dice nada de Prod', () => {
    expect(cubre(excepcion({ ambiente: 'Dev' }), hallazgo())).toBe(false)
  })

  it('no cubre otro control sobre el mismo recurso', () => {
    expect(cubre(excepcion(), hallazgo({ control: 'CO-NET-02' }))).toBe(false)
  })

  it('no cubre un hallazgo sin control', () => {
    expect(cubre(excepcion(), hallazgo({ control: null }))).toBe(false)
  })

  it('solo una activa y vigente cubre', () => {
    for (const e of [
      excepcion({ estadoGuardado: 'Pendiente' }),
      excepcion({ estadoGuardado: 'Rechazada' }),
      excepcion({ estadoGuardado: 'Revocada' }),
      excepcion({ venceEl: enDias(-1) }),
    ]) {
      expect(excepcionQueCubre(hallazgo(), [e], AHORA)).toBeNull()
    }
    expect(excepcionQueCubre(hallazgo(), [excepcion()], AHORA)?.codigo).toBe('EXC-1')
  })
})

describe('estado mostrado del hallazgo', () => {
  it.each(['Abierto', 'En remediación'] as const)('%s cubierto se muestra como Excepción', (estado) => {
    expect(estadoMostrado(estado, true)).toBe('Excepción')
  })

  it.each(['Abierto', 'En remediación', 'Cerrado'] as const)('%s sin cubrir no cambia', (estado) => {
    expect(estadoMostrado(estado, false)).toBe(estado)
  })

  it('un cerrado se queda cerrado aunque haya excepción', () => {
    expect(estadoMostrado('Cerrado', true)).toBe('Cerrado')
  })
})
