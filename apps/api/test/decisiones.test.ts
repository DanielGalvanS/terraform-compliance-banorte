import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { construirApp, PREFIJO } from '../src/app.ts'
import { cargarConfig } from '../src/config.ts'
import { repositorioEnMemoria } from '../src/repositorios/hallazgosRepositorio.ts'

/**
 * Salida real de `python -m agente analizar` (con el modelo falso de sus
 * pruebas), pasada a camelCase. Si el agente cambia sus campos, la prueba
 * `test_el_cuerpo_coincide_con_el_contrato_de_la_api` de apps/agent falla.
 */
const DECISION = JSON.parse(
  readFileSync(new URL('./datos/decision_agente.json', import.meta.url), 'utf8'),
) as Cuerpo

/** El JSON tal cual: las pruebas lo alteran para mandar cuerpos inválidos. */
type Cuerpo = Record<string, any> & { clasificaciones: Record<string, any>[] }

const nueva = (cambios: Record<string, unknown> = {}): Cuerpo => ({
  ...structuredClone(DECISION),
  ejecucionId: crypto.randomUUID(),
  ...cambios,
})

/** App sin hallazgos de ejemplo, para contar solo los que crea la decisión. */
async function app() {
  return construirApp({ config: cargarConfig({ NIVEL_LOG: 'fatal' }), hallazgos: repositorioEnMemoria() })
}

const registrar = (servidor: Awaited<ReturnType<typeof app>>, cuerpo: object) =>
  servidor.inject({ method: 'POST', url: `${PREFIJO}/decisiones`, payload: cuerpo })

describe('POST /decisiones', () => {
  it('registra la decisión y un hallazgo por violación', async () => {
    const servidor = await app()
    const respuesta = await registrar(servidor, nueva())

    expect(respuesta.statusCode).toBe(201)
    const decision = respuesta.json()
    expect(decision.clasificaciones).toHaveLength(13)
    expect(decision.clasificaciones.every((c: { hallazgoId: string | null }) => c.hallazgoId)).toBe(true)

    const { hallazgos } = (await servidor.inject(`${PREFIJO}/hallazgos`)).json()
    expect(hallazgos).toHaveLength(13)
  })

  it('la severidad del hallazgo sale del catálogo, no del cuerpo', async () => {
    const servidor = await app()
    const cuerpo = nueva()
    // El agente manda severidad, pero la API no la usa.
    for (const c of cuerpo.clasificaciones) c.severidad = 'Baja'
    const { clasificaciones } = (await registrar(servidor, cuerpo)).json()

    const sec = clasificaciones.find((c: { control: string }) => c.control === 'CO-SEC-01')
    const hallazgo = (await servidor.inject(`${PREFIJO}/hallazgos/${sec.hallazgoId}`)).json()
    expect(hallazgo.severidad).toBe('Crítica')
    expect(hallazgo.origen).toBe('Plan')
    expect(hallazgo.recurso).toBe('google_sql_user.app')
  })

  it('deja un evento agente.decision encadenado en la evidencia', async () => {
    const servidor = await app()
    const cuerpo = nueva()
    const decision = (await registrar(servidor, cuerpo)).json()

    const { eventos, integra } = (
      await servidor.inject(`${PREFIJO}/evidencia?tipo=agente.decision`)
    ).json()
    expect(integra).toBe(true)
    expect(eventos).toHaveLength(1)
    expect(eventos[0].objetoId).toBe(cuerpo.ejecucionId)
    expect(eventos[0].actor).toBe('app-agente')
    expect(eventos[0].detalle.hashEntradas).toBe(cuerpo.hashEntradas)
    expect(eventos[0].detalle.hashDecision).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(decision.evidencia).toEqual({ secuencia: eventos[0].secuencia, hash: eventos[0].hash })
  })

  it('reenviar la misma ejecución no duplica nada', async () => {
    const servidor = await app()
    const cuerpo = nueva()
    const primera = await registrar(servidor, cuerpo)
    const segunda = await registrar(servidor, cuerpo)

    expect(segunda.statusCode).toBe(200)
    expect(segunda.json()).toEqual(primera.json())
    expect((await servidor.inject(`${PREFIJO}/hallazgos`)).json().hallazgos).toHaveLength(13)
    expect((await servidor.inject(`${PREFIJO}/evidencia`)).json().eventos).toHaveLength(1)
  })

  it('la misma ejecución con otro contenido es un conflicto', async () => {
    const servidor = await app()
    const cuerpo = nueva()
    await registrar(servidor, cuerpo)

    const respuesta = await registrar(servidor, { ...cuerpo, resumen: 'Otro resumen' })
    expect(respuesta.statusCode).toBe(409)
  })

  it('otra ejecución sobre las mismas violaciones reutiliza los hallazgos', async () => {
    const servidor = await app()
    await registrar(servidor, nueva())
    await registrar(servidor, nueva({ commit: 'f'.repeat(40) }))

    expect((await servidor.inject(`${PREFIJO}/hallazgos`)).json().hallazgos).toHaveLength(13)
    expect((await servidor.inject(`${PREFIJO}/evidencia`)).json().eventos).toHaveLength(2)
  })

  it('si la violación reaparece, reabre el hallazgo cerrado y lo deja en la evidencia', async () => {
    const servidor = await app()
    const primera = (await registrar(servidor, nueva())).json()
    const id = primera.clasificaciones[0].hallazgoId
    await servidor.inject({
      method: 'PATCH',
      url: `${PREFIJO}/hallazgos/${id}/estado`,
      payload: { estado: 'Cerrado', comentario: 'Se corrigió en main', cambiadoPor: 'Roberto Silva' },
    })

    const segunda = nueva()
    await registrar(servidor, segunda)

    expect((await servidor.inject(`${PREFIJO}/hallazgos/${id}`)).json().estado).toBe('Abierto')
    const { eventos, integra } = (await servidor.inject(`${PREFIJO}/evidencia?objetoId=${id}`)).json()
    expect(integra).toBe(true)
    expect(eventos[0]).toMatchObject({ actor: 'app-agente', detalle: { de: 'Cerrado', a: 'Abierto' } })
    expect(eventos[0].detalle.comentario).toContain(segunda.ejecucionId)
  })

  it('un error del agente se registra en la evidencia sin crear hallazgos', async () => {
    const servidor = await app()
    const respuesta = await registrar(
      servidor,
      nueva({ estado: 'error_agente', clasificaciones: [], error: 'modelo saturado o sin respuesta (503)' }),
    )

    expect(respuesta.statusCode).toBe(201)
    expect((await servidor.inject(`${PREFIJO}/hallazgos`)).json().hallazgos).toHaveLength(0)
    const { eventos } = (await servidor.inject(`${PREFIJO}/evidencia`)).json()
    expect(eventos[0].detalle.estado).toBe('error_agente')
  })

  it('un control desconocido se registra como crítico', async () => {
    const servidor = await app()
    const cuerpo = nueva()
    cuerpo.clasificaciones = [{ ...cuerpo.clasificaciones[0]!, control: 'desconocido', recurso: null }]
    const { clasificaciones } = (await registrar(servidor, cuerpo)).json()

    const hallazgo = (await servidor.inject(`${PREFIJO}/hallazgos/${clasificaciones[0].hallazgoId}`)).json()
    expect(hallazgo.severidad).toBe('Crítica')
    expect(hallazgo.control).toBeNull()
    expect(hallazgo.recurso).toBe('desconocido')
  })

  it.each([
    ['sin ejecucionId', { ejecucionId: undefined }],
    ['un estado inventado', { estado: 'aprobado' }],
    ['un hash mal formado', { hashEntradas: 'abc' }],
  ])('rechaza %s', async (_nombre, cambios) => {
    const servidor = await app()
    expect((await registrar(servidor, nueva(cambios))).statusCode).toBe(400)
  })

  it('rechaza una prioridad fuera de rango', async () => {
    const servidor = await app()
    const cuerpo = nueva()
    cuerpo.clasificaciones[0]!.prioridad = 9
    expect((await registrar(servidor, cuerpo)).statusCode).toBe(400)
  })
})

describe('GET /decisiones', () => {
  it('encuentra la decisión que explica un hallazgo', async () => {
    const servidor = await app()
    await registrar(servidor, nueva({ commit: 'a'.repeat(40) }))
    const ultima = (await registrar(servidor, nueva({ commit: 'b'.repeat(40) }))).json()
    const hallazgoId = ultima.clasificaciones[0].hallazgoId

    const { decisiones } = (await servidor.inject(`${PREFIJO}/decisiones?hallazgoId=${hallazgoId}`)).json()
    // Las dos ejecuciones vieron el mismo hallazgo; la más reciente va primero.
    expect(decisiones.map((d: { commit: string }) => d.commit)).toEqual(['b'.repeat(40), 'a'.repeat(40)])
  })

  it('una decisión por ejecución, o 404', async () => {
    const servidor = await app()
    const cuerpo = nueva()
    await registrar(servidor, cuerpo)

    expect((await servidor.inject(`${PREFIJO}/decisiones/${cuerpo.ejecucionId}`)).statusCode).toBe(200)
    expect((await servidor.inject(`${PREFIJO}/decisiones/${crypto.randomUUID()}`)).statusCode).toBe(404)
  })
})
