import { beforeAll, describe, expect, it } from 'vitest'
import { construirApp, PREFIJO } from '../src/app.ts'
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
import { configDePrueba, conToken, tokenDe, USUARIOS } from './auth.ts'

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

describe('rutas: hallazgos cubiertos por una excepción', () => {
  let app: Awaited<ReturnType<typeof construirApp>>
  let pipeline: string
  let carlos: string
  let roberto: string

  beforeAll(async () => {
    app = await construirApp({ config: configDePrueba() })
    await app.ready()
    pipeline = await tokenDe(USUARIOS.pipeline)
    carlos = await tokenDe(USUARIOS.desarrollador)
    roberto = await tokenDe(USUARIOS.aprobador)
  })

  const leer = async (ruta: string) =>
    (await app.inject(conToken({ method: 'GET', url: `${PREFIJO}${ruta}` }))).json()

  const registrarHallazgo = async (extra: Record<string, string> = {}) =>
    (
      await app.inject(
        conToken(
          {
            method: 'POST',
            url: `${PREFIJO}/hallazgos`,
            payload: {
              control: 'CO-DB-01',
              titulo: 'Cloud SQL con IP pública',
              recurso: `google_sql_database_instance.${crypto.randomUUID().slice(0, 8)}`,
              severidad: 'Crítica',
              ambiente: 'Prod',
              origen: 'Drift',
              mensaje: 'La instancia tiene ipv4_enabled = true.',
              ...extra,
            },
          },
          pipeline,
        ),
      )
    ).json()

  const exceptuar = async (hallazgo: { control: string; recurso: string; ambiente: string }) => {
    const solicitud = await app.inject(
      conToken(
        {
          method: 'POST',
          url: `${PREFIJO}/excepciones`,
          payload: {
            control: hallazgo.control,
            recurso: hallazgo.recurso,
            ambiente: hallazgo.ambiente,
            justificacion: 'Migración de red privada programada con el equipo de bases.',
            venceEl: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
            aprobador: 'Roberto Silva',
          },
        },
        carlos,
      ),
    )
    const id = solicitud.json().id as string
    await app.inject(
      conToken(
        {
          method: 'POST',
          url: `${PREFIJO}/excepciones/${id}/aprobar`,
          payload: { comentario: 'Riesgo aceptado durante la migración' },
        },
        roberto,
      ),
    )
    return id
  }

  it('en la semilla, EXC-1048 cubre el firewall de Prod', async () => {
    const { hallazgos } = await leer('/hallazgos?recurso=google_compute_firewall.allow_ssh')
    const prod = hallazgos.find((h: { ambiente: string }) => h.ambiente === 'Prod')
    expect(prod.estado).toBe('Excepción')
    expect(prod.excepcion.codigo).toBe('EXC-1048')
  })

  it('un hallazgo nuevo sin excepción nace Abierto y sin referencia', async () => {
    const h = await registrarHallazgo()
    expect(h.estado).toBe('Abierto')
    expect(h.excepcion).toBeNull()
  })

  it('al aprobar la excepción, el hallazgo se muestra como Excepción', async () => {
    const h = await registrarHallazgo()
    const excepcionId = await exceptuar(h)
    const leido = await leer(`/hallazgos/${h.id}`)
    expect(leido.estado).toBe('Excepción')
    expect(leido.excepcion.id).toBe(excepcionId)
  })

  it('el filtro por estado usa el estado mostrado', async () => {
    const h = await registrarHallazgo()
    await exceptuar(h)
    const ids = async (estado: string) =>
      (await leer(`/hallazgos?estado=${estado}`)).hallazgos.map((x: { id: string }) => x.id)
    expect(await ids('Excepción')).toContain(h.id)
    expect(await ids('Abierto')).not.toContain(h.id)
  })

  it('el resumen deja de contarlo como abierto', async () => {
    const h = await registrarHallazgo()
    const antes = (await leer('/resumen')).hallazgosAbiertos
    await exceptuar(h)
    expect((await leer('/resumen')).hallazgosAbiertos).toBe(antes - 1)
  })

  it('no se cambia a mano mientras lo cubre una excepción (409)', async () => {
    const h = await registrarHallazgo()
    await exceptuar(h)
    const r = await app.inject(
      conToken(
        {
          method: 'PATCH',
          url: `${PREFIJO}/hallazgos/${h.id}/estado`,
          payload: { estado: 'Cerrado', comentario: 'Se corrigió en el PR 42' },
        },
        roberto,
      ),
    )
    expect(r.statusCode).toBe(409)
    expect(r.json().error).toContain('revócala')
  })

  it('un hallazgo nuevo nace cubierto si ya hay una excepción aprobada', async () => {
    const h = await registrarHallazgo({
      control: 'CO-NET-01',
      recurso: 'module.firewall.google_compute_firewall.allow_ssh',
      titulo: 'SSH abierto',
      mensaje: 'Puerto 22 abierto a 0.0.0.0/0',
    })
    expect(h.estado).toBe('Excepción')
    expect(h.excepcion.codigo).toBe('EXC-1048')
  })

  it('una excepción vencida no cubre', async () => {
    // EXC-1031 de la semilla: CO-TAG-01 sobre este secreto en Prod, ya vencida.
    const h = await registrarHallazgo({
      control: 'CO-TAG-01',
      recurso: 'google_secret_manager_secret.api_key',
      titulo: 'Etiquetas faltantes',
      severidad: 'Media',
      mensaje: 'Falta centro_costos.',
    })
    expect(h.estado).toBe('Abierto')
  })

  it('una excepción de otro ambiente no cubre', async () => {
    const h = await registrarHallazgo({
      control: 'CO-NET-01',
      recurso: 'google_compute_firewall.allow_ssh',
      ambiente: 'QA',
      titulo: 'SSH abierto',
      mensaje: 'Puerto 22 abierto a 0.0.0.0/0',
    })
    expect(h.estado).toBe('Abierto')
  })
})
