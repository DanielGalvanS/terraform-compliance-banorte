import { beforeAll, describe, expect, it } from 'vitest'
import { construirApp, PREFIJO } from '../src/app.ts'
import { cargarConfig } from '../src/config.ts'
import {
  estadoVigente,
  MAXIMO_DIAS_VIGENCIA,
  MINIMO_JUSTIFICACION,
  validarSolicitud,
} from '../src/model/reglasExcepciones.ts'

const AHORA = new Date('2026-11-14T12:00:00Z')
const enDias = (dias: number) =>
  new Date(AHORA.getTime() + dias * 86_400_000).toISOString().slice(0, 10)

const controles = new Set(['CO-NET-01', 'CO-DB-02'])
const base = {
  control: 'CO-NET-01',
  justificacion: 'x'.repeat(MINIMO_JUSTIFICACION),
  venceEl: enDias(30),
}
const campos = (solicitud: typeof base) =>
  validarSolicitud(solicitud, controles, AHORA).map((m) => m.campo)

describe('reglas de la solicitud', () => {
  it('acepta una solicitud correcta', () => {
    expect(validarSolicitud(base, controles, AHORA)).toEqual([])
  })

  it('rechaza un control que no está en el catálogo', () => {
    expect(campos({ ...base, control: 'CO-NO-99' })).toContain('control')
  })

  it('rechaza una justificación corta', () => {
    expect(campos({ ...base, justificacion: 'muy corta' })).toContain('justificacion')
  })

  it('no acepta espacios como justificación', () => {
    expect(campos({ ...base, justificacion: ' '.repeat(50) })).toContain('justificacion')
  })

  it('rechaza una vigencia en el pasado', () => {
    expect(campos({ ...base, venceEl: enDias(-1) })).toContain('venceEl')
  })

  it(`rechaza más de ${MAXIMO_DIAS_VIGENCIA} días`, () => {
    expect(campos({ ...base, venceEl: enDias(MAXIMO_DIAS_VIGENCIA + 1) })).toContain('venceEl')
  })

  it('acepta justo el límite de vigencia', () => {
    expect(campos({ ...base, venceEl: enDias(MAXIMO_DIAS_VIGENCIA) })).toEqual([])
  })

  it('acepta que venza hoy', () => {
    expect(campos({ ...base, venceEl: enDias(0) })).toEqual([])
  })

  it('rechaza un formato de fecha inválido', () => {
    expect(campos({ ...base, venceEl: '14/11/2026' })).toContain('venceEl')
  })

  it('acumula todos los motivos, no solo el primero', () => {
    const motivos = campos({ control: 'CO-NO-99', justificacion: 'corta', venceEl: 'ayer' })
    expect(motivos.sort()).toEqual(['control', 'justificacion', 'venceEl'])
  })
})

describe('estado vigente', () => {
  it('una activa cuya fecha pasó se muestra vencida', () => {
    expect(estadoVigente('Activa', enDias(-1), AHORA)).toBe('Vencida')
  })

  it('una pendiente cuya fecha pasó también', () => {
    expect(estadoVigente('Pendiente', enDias(-1), AHORA)).toBe('Vencida')
  })

  it('una activa vigente sigue activa', () => {
    expect(estadoVigente('Activa', enDias(1), AHORA)).toBe('Activa')
  })

  it('una rechazada no se convierte en vencida', () => {
    expect(estadoVigente('Rechazada', enDias(-30), AHORA)).toBe('Rechazada')
  })

  it('una revocada tampoco', () => {
    expect(estadoVigente('Revocada', enDias(-30), AHORA)).toBe('Revocada')
  })
})

describe('rutas de excepciones', () => {
  let app: Awaited<ReturnType<typeof construirApp>>

  beforeAll(async () => {
    app = await construirApp({ config: cargarConfig({ NIVEL_LOG: 'fatal' }) })
    await app.ready()
  })

  const solicitud = {
    control: 'CO-NET-01',
    recurso: 'google_compute_firewall.allow_ssh',
    ambiente: 'Prod',
    justificacion: 'Ventana de migración coordinada con el equipo de seguridad.',
    venceEl: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
    aprobador: 'Roberto Silva',
  }

  it('completa el control desde el catálogo', async () => {
    const r = await app.inject({ method: 'GET', url: `${PREFIJO}/excepciones` })
    const primera = r.json().excepciones[0]
    expect(primera.controlNombre).not.toBe('Control desconocido')
    expect(primera.severidad).toBeTruthy()
  })

  it('deriva Vencida de la fecha, aunque esté guardada como Activa', async () => {
    const r = await app.inject({ method: 'GET', url: `${PREFIJO}/excepciones?estado=Vencida` })
    const vencidas = r.json().excepciones
    expect(vencidas.length).toBeGreaterThan(0)
    for (const e of vencidas) expect(e.estado).toBe('Vencida')
  })

  it('una solicitud válida nace Pendiente y sin aprobador', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `${PREFIJO}/excepciones`,
      payload: solicitud,
    })
    expect(r.statusCode).toBe(201)
    // Nada se exceptúa sin que una persona lo apruebe.
    expect(r.json().estado).toBe('Pendiente')
    expect(r.json().aprobadaPor).toBeNull()
    expect(r.json().codigo).toMatch(/^EXC-\d+$/)
  })

  it('la severidad la decide el control, no quien solicita', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `${PREFIJO}/excepciones`,
      payload: { ...solicitud, control: 'CO-TAG-01' },
    })
    // CO-TAG-01 es de severidad media en el catálogo.
    expect(r.json().severidad).toBe('Media')
  })

  it('devuelve 422 con el detalle de cada campo', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `${PREFIJO}/excepciones`,
      payload: { ...solicitud, justificacion: 'corta', control: 'CO-NO-99' },
    })
    expect(r.statusCode).toBe(422)
    expect(r.json().motivos.map((m: { campo: string }) => m.campo).sort()).toEqual([
      'control',
      'justificacion',
    ])
  })

  it('la nueva aparece en la lista', async () => {
    const antes = (await app.inject({ method: 'GET', url: `${PREFIJO}/excepciones` })).json()
      .excepciones.length
    await app.inject({ method: 'POST', url: `${PREFIJO}/excepciones`, payload: solicitud })
    const despues = (await app.inject({ method: 'GET', url: `${PREFIJO}/excepciones` })).json()
      .excepciones.length
    expect(despues).toBe(antes + 1)
  })
})
