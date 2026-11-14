import { beforeAll, describe, expect, it } from 'vitest'
import { construirApp, PREFIJO } from '../src/app.ts'
import { cargarConfig } from '../src/config.ts'

/**
 * Las pruebas levantan la app con `inject`: sin puerto, sin red y sin base de
 * datos. El catálogo sí se lee del archivo real, que es justo lo que interesa
 * comprobar: que la API y la compuerta hablan del mismo catálogo.
 */
let app: Awaited<ReturnType<typeof construirApp>>

beforeAll(async () => {
  // 'fatal' es el nivel más callado que acepta la configuración.
  app = await construirApp({ config: cargarConfig({ NIVEL_LOG: 'fatal' }) })
  await app.ready()
})

const cuerpoValido = {
  control: 'CO-VM-01',
  titulo: 'VM con IP pública',
  recurso: 'google_compute_instance.vm-01',
  severidad: 'Alta',
  ambiente: 'Dev',
  origen: 'Plan',
  mensaje: 'La instancia declara access_config.',
}

describe('catálogo', () => {
  it('sirve los marcos del archivo de políticas', async () => {
    const r = await app.inject({ method: 'GET', url: `${PREFIJO}/marcos` })
    expect(r.statusCode).toBe(200)
    const cortos = r.json().marcos.map((m: { nombreCorto: string }) => m.nombreCorto)
    expect(cortos.sort()).toEqual(['CIS GCP', 'LFPDPPP', 'NIST 800-53', 'SOC 2'])
  })

  it('cada control declara al menos un marco', async () => {
    const r = await app.inject({ method: 'GET', url: `${PREFIJO}/controles` })
    const controles = r.json().controles
    expect(controles.length).toBeGreaterThan(0)
    for (const control of controles) {
      expect(control.mapeo.length, `${control.codigo} sin mapeo`).toBeGreaterThan(0)
    }
  })

  it('filtra controles por marco', async () => {
    const r = await app.inject({ method: 'GET', url: `${PREFIJO}/controles?marco=LFPDPPP` })
    const controles = r.json().controles
    expect(controles.length).toBeGreaterThan(0)
    for (const control of controles) {
      expect(control.mapeo.some((m: { marco: string }) => m.marco === 'LFPDPPP')).toBe(true)
    }
  })
})

describe('hallazgos', () => {
  it('devuelve 404 ante un identificador que no existe', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `${PREFIJO}/hallazgos/00000000-0000-4000-8000-000000000000`,
    })
    expect(r.statusCode).toBe(404)
  })

  it('rechaza un identificador que no es uuid', async () => {
    const r = await app.inject({ method: 'GET', url: `${PREFIJO}/hallazgos/no-es-uuid` })
    expect(r.statusCode).toBe(400)
  })

  it('rechaza un cuerpo con severidad inválida', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `${PREFIJO}/hallazgos`,
      payload: { ...cuerpoValido, severidad: 'Urgentísima' },
    })
    expect(r.statusCode).toBe(400)
  })

  it('crea un hallazgo y lo devuelve por su identificador', async () => {
    const creado = await app.inject({
      method: 'POST',
      url: `${PREFIJO}/hallazgos`,
      payload: cuerpoValido,
    })
    expect(creado.statusCode).toBe(201)
    expect(creado.json().estado).toBe('Abierto')

    const leido = await app.inject({
      method: 'GET',
      url: `${PREFIJO}/hallazgos/${creado.json().id}`,
    })
    expect(leido.statusCode).toBe(200)
    expect(leido.json().titulo).toBe(cuerpoValido.titulo)
  })

  it('con la misma Idempotency-Key no duplica', async () => {
    // Valor deliberadamente trivial: una clave con pinta de token haría que
    // el escáner de secretos del pipeline marcara esta prueba.
    const cabeceras = { 'idempotency-key': 'clave-de-prueba' }

    const primero = await app.inject({
      method: 'POST',
      url: `${PREFIJO}/hallazgos`,
      headers: cabeceras,
      payload: cuerpoValido,
    })
    const segundo = await app.inject({
      method: 'POST',
      url: `${PREFIJO}/hallazgos`,
      headers: cabeceras,
      payload: cuerpoValido,
    })

    expect(primero.statusCode).toBe(201)
    // 200 y no 201: el reintento no creó nada.
    expect(segundo.statusCode).toBe(200)
    expect(segundo.json().id).toBe(primero.json().id)
  })

  it('sin la cabecera sí crea otro', async () => {
    const uno = await app.inject({ method: 'POST', url: `${PREFIJO}/hallazgos`, payload: cuerpoValido })
    const dos = await app.inject({ method: 'POST', url: `${PREFIJO}/hallazgos`, payload: cuerpoValido })
    expect(dos.json().id).not.toBe(uno.json().id)
  })

  it('filtra por severidad', async () => {
    const r = await app.inject({ method: 'GET', url: `${PREFIJO}/hallazgos?severidad=Crítica` })
    for (const h of r.json().hallazgos) expect(h.severidad).toBe('Crítica')
  })
})

describe('salud', () => {
  it('avisa de que no hay persistencia', async () => {
    const r = await app.inject({ method: 'GET', url: '/salud' })
    expect(r.json().estado).toBe('ok')
    // Mientras sea false, lo que sirve la API son datos de ejemplo.
    expect(r.json().persistencia).toBe(false)
  })
})
