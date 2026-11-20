import { beforeAll, describe, expect, it } from 'vitest'
import { construirApp, PREFIJO } from '../src/app.ts'
import type { NuevaDecisionAgente } from '../src/model/esquemas.ts'
import { validarDecisionAgente } from '../src/model/reglasDecisiones.ts'
import { evidenciaEnMemoria } from '../src/repositorios/evidenciaRepositorio.ts'
import { configDePrueba, conToken, tokenDe, USUARIOS } from './auth.ts'

const HASH = `sha256:${'a'.repeat(64)}`

const clasificacion = (extra: Partial<NuevaDecisionAgente['clasificaciones'][number]> = {}) => ({
  violacion: 'V01',
  control: 'CO-NET-01',
  recurso: 'module.firewall.google_compute_firewall.allow_ssh',
  severidad: 'Crítica',
  prioridad: 1,
  accionSugerida: 'proponer_pr' as const,
  confianza: 90,
  explicacion: 'El puerto 22 queda abierto a internet.',
  remediacion: 'Restringir el origen al rango de IAP.',
  ...extra,
})

const decision = (extra: Partial<NuevaDecisionAgente> = {}): NuevaDecisionAgente => ({
  ejecucionId: crypto.randomUUID(),
  fecha: '2026-11-20T12:00:00+00:00',
  origen: 'Plan',
  ambiente: 'Dev',
  commit: 'abc1234',
  resultadoCompuerta: 'bloqueado',
  estado: 'analizado',
  resumen: 'Una violación crítica de red.',
  clasificaciones: [clasificacion()],
  herramientasUsadas: ['consultar_control'],
  ajustes: [],
  modelo: 'gemini-3.5-flash',
  versionPrompt: '3',
  hashEntradas: HASH,
  error: null,
  ...extra,
})

describe('reglas de la decisión del agente', () => {
  const severidadDe = (c: string) => ({ 'CO-NET-01': 'Crítica', 'CO-TAG-01': 'Media' } as const)[c] ?? null
  const sinExcepciones = () => false
  const campos = (d: NuevaDecisionAgente, excepcion = sinExcepciones) =>
    validarDecisionAgente(d, severidadDe, excepcion).map((m) => m.campo)

  it('acepta un análisis coherente', () => {
    expect(campos(decision())).toEqual([])
  })

  it('acepta sin_violaciones con veredicto conforme', () => {
    expect(
      campos(decision({ resultadoCompuerta: 'conforme', estado: 'sin_violaciones', clasificaciones: [] })),
    ).toEqual([])
  })

  it('un veredicto conforme no puede llegar como analizado', () => {
    expect(campos(decision({ resultadoCompuerta: 'conforme' }))).toContain('estado')
  })

  it('sin_violaciones con un veredicto bloqueado es incoherente', () => {
    expect(
      campos(decision({ estado: 'sin_violaciones', clasificaciones: [] })),
    ).toContain('estado')
  })

  it('un análisis sin clasificaciones no analizó nada', () => {
    expect(campos(decision({ clasificaciones: [] }))).toContain('clasificaciones')
  })

  it('error_agente no lleva clasificaciones', () => {
    expect(campos(decision({ estado: 'error_agente' }))).toContain('clasificaciones')
  })

  it('rechaza una severidad distinta a la del catálogo', () => {
    expect(campos(decision({ clasificaciones: [clasificacion({ severidad: 'Baja' })] }))).toEqual([
      'clasificaciones.0',
    ])
  })

  it('rechaza un control que no está en el catálogo', () => {
    expect(
      campos(decision({ clasificaciones: [clasificacion({ control: 'CO-NO-99', severidad: 'Desconocida' })] })),
    ).toEqual(['clasificaciones.0'])
  })

  it('rechaza violaciones repetidas', () => {
    expect(campos(decision({ clasificaciones: [clasificacion(), clasificacion()] }))).toEqual([
      'clasificaciones.1',
    ])
  })

  it('«ninguna» acción sin excepción activa no se acepta', () => {
    const d = decision({ clasificaciones: [clasificacion({ accionSugerida: 'ninguna' })] })
    expect(campos(d)).toEqual(['clasificaciones.0'])
    expect(campos(d, () => true)).toEqual([])
  })

  it('acumula todos los motivos', () => {
    const d = decision({
      resultadoCompuerta: 'conforme',
      clasificaciones: [clasificacion({ severidad: 'Baja', accionSugerida: 'ninguna' })],
    })
    expect(validarDecisionAgente(d, severidadDe, sinExcepciones).length).toBeGreaterThanOrEqual(3)
  })
})

describe('rutas de decisiones', () => {
  let app: Awaited<ReturnType<typeof construirApp>>
  const evidencia = evidenciaEnMemoria()
  let agente: string

  beforeAll(async () => {
    app = await construirApp({ config: configDePrueba(), evidencia })
    await app.ready()
    agente = await tokenDe(USUARIOS.agente)
  })

  const registrar = (cuerpo: NuevaDecisionAgente, token = agente) =>
    app.inject(conToken({ method: 'POST', url: `${PREFIJO}/decisiones`, payload: cuerpo }, token))

  it('el agente registra su decisión: 201', async () => {
    const r = await registrar(decision())
    expect(r.statusCode).toBe(201)
    expect(r.json().registradaPor).toBe('Agente de cumplimiento')
  })

  it('reenviar la misma ejecución responde 200 y no duplica', async () => {
    const d = decision()
    const primera = await registrar(d)
    const segunda = await registrar(d)
    expect(segunda.statusCode).toBe(200)
    expect(segunda.json().id).toBe(primera.json().id)
    const lista = await app.inject(
      conToken({ method: 'GET', url: `${PREFIJO}/decisiones?ejecucionId=${d.ejecucionId}` }),
    )
    expect(lista.json().decisiones).toHaveLength(1)
  })

  it('la misma ejecución con otras entradas responde 409', async () => {
    const d = decision()
    await registrar(d)
    const r = await registrar({ ...d, hashEntradas: `sha256:${'b'.repeat(64)}` })
    expect(r.statusCode).toBe(409)
  })

  it.each([
    ['Desarrollador', USUARIOS.desarrollador],
    ['Compliance Lead', USUARIOS.lead],
    ['Pipeline', USUARIOS.pipeline],
  ])('el %s no puede registrar decisiones del agente (403)', async (_, identidad) => {
    expect((await registrar(decision(), await tokenDe(identidad))).statusCode).toBe(403)
  })

  it('una decisión incoherente responde 422 con motivos', async () => {
    const r = await registrar(decision({ clasificaciones: [clasificacion({ severidad: 'Baja' })] }))
    expect(r.statusCode).toBe(422)
    expect(r.json().motivos[0].campo).toBe('clasificaciones.0')
  })

  it('«ninguna» se acepta si hay una excepción activa para ese control y recurso', async () => {
    // EXC-1048 de la semilla: CO-NET-01 sobre google_compute_firewall.allow_ssh, activa.
    const r = await registrar(
      decision({ clasificaciones: [clasificacion({ accionSugerida: 'ninguna' })] }),
    )
    expect(r.statusCode).toBe(201)
  })

  it('cada clasificación se liga al hallazgo del mismo control y recurso', async () => {
    const r = await registrar(decision())
    const hallazgoId = r.json().clasificaciones[0].hallazgoId
    expect(hallazgoId).not.toBeNull()
    const hallazgo = await app.inject(conToken({ method: 'GET', url: `${PREFIJO}/hallazgos/${hallazgoId}` }))
    expect(hallazgo.json()).toMatchObject({
      control: 'CO-NET-01',
      recurso: 'google_compute_firewall.allow_ssh',
    })
  })

  it('sin hallazgo relacionado queda en null', async () => {
    const r = await registrar(
      decision({
        clasificaciones: [clasificacion({ recurso: 'google_compute_firewall.otra' })],
      }),
    )
    expect(r.json().clasificaciones[0].hallazgoId).toBeNull()
  })

  it('registrar deja evidencia y no la duplica al reenviar', async () => {
    const d = decision()
    const creada = (await registrar(d)).json()
    await registrar(d)
    const eventos = await evidencia.listar({ objetoId: creada.id })
    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({
      tipo: 'agente.decision',
      actor: 'Agente de cumplimiento',
      detalle: { ejecucionId: d.ejecucionId, hashEntradas: HASH, sujeto: 'app-agente' },
    })
    expect((await evidencia.verificar()).integra).toBe(true)
  })

  it('el Auditor puede leerlas, y GET por id da 404 si no existe', async () => {
    const auditora = await tokenDe(USUARIOS.auditor)
    const creada = (await registrar(decision())).json()
    const r = await app.inject(
      conToken({ method: 'GET', url: `${PREFIJO}/decisiones/${creada.id}` }, auditora),
    )
    expect(r.statusCode).toBe(200)
    const nada = await app.inject(
      conToken(
        { method: 'GET', url: `${PREFIJO}/decisiones/00000000-0000-4000-8000-000000000000` },
        auditora,
      ),
    )
    expect(nada.statusCode).toBe(404)
  })

  it('el registro no cambia el estado de los hallazgos', async () => {
    const antes = (
      await app.inject(conToken({ method: 'GET', url: `${PREFIJO}/hallazgos?control=CO-NET-01` }))
    ).json()
    await registrar(decision({ clasificaciones: [clasificacion({ accionSugerida: 'escalar_jira' })] }))
    const despues = (
      await app.inject(conToken({ method: 'GET', url: `${PREFIJO}/hallazgos?control=CO-NET-01` }))
    ).json()
    expect(despues).toEqual(antes)
  })
})
