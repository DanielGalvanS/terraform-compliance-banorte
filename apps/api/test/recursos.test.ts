import { beforeAll, describe, expect, it } from 'vitest'
import { construirApp, PREFIJO } from '../src/app.ts'
import { cargarConfig } from '../src/config.ts'
import { estadoDeRecurso, etiquetasFaltantes } from '../src/model/recursos.ts'

const OBLIGATORIAS = ['duenio', 'ambiente', 'clasificacion_datos', 'centro_costos', 'marco_aplicable']
const completas = Object.fromEntries(OBLIGATORIAS.map((c) => [c, 'x']))
const ETIQUETABLES = ['google_storage_bucket', 'google_secret_manager_secret']

describe('etiquetas faltantes', () => {
  it('ninguna cuando están todas', () => {
    expect(etiquetasFaltantes(completas, OBLIGATORIAS)).toEqual([])
  })

  it('detecta la ausente', () => {
    const { centro_costos: _, ...parciales } = completas
    expect(etiquetasFaltantes(parciales, OBLIGATORIAS)).toEqual(['centro_costos'])
  })

  // Una etiqueta vacía no cumple: el campo existe pero no dice nada.
  it('una etiqueta en blanco cuenta como ausente', () => {
    expect(etiquetasFaltantes({ ...completas, duenio: '   ' }, OBLIGATORIAS)).toEqual(['duenio'])
  })

  it('las etiquetas extra no estorban', () => {
    expect(etiquetasFaltantes({ ...completas, equipo: 'pagos' }, OBLIGATORIAS)).toEqual([])
  })

  // Una VPC no admite labels en GCP: exigírselas marcaría como incumplidor un
  // recurso que nadie puede arreglar.
  it('no exige etiquetas a un tipo que no las admite', () => {
    expect(
      etiquetasFaltantes({}, OBLIGATORIAS, 'google_compute_network', ETIQUETABLES),
    ).toEqual([])
  })

  it('sí las exige a un tipo que las admite', () => {
    expect(
      etiquetasFaltantes({}, OBLIGATORIAS, 'google_storage_bucket', ETIQUETABLES),
    ).toEqual(OBLIGATORIAS)
  })
})

describe('estado derivado', () => {
  it('sin hallazgos y con etiquetas, conforme', () => {
    expect(estadoDeRecurso([], [])).toBe('Conforme')
  })

  it('un hallazgo abierto manda sobre todo lo demás', () => {
    expect(estadoDeRecurso(['centro_costos'], [{ estado: 'Abierto' }])).toBe('No conforme')
  })

  it('sin hallazgos pero con etiquetas faltantes', () => {
    expect(estadoDeRecurso(['centro_costos'], [])).toBe('Sin etiqueta')
  })

  it('en remediación es advertencia, no incumplimiento', () => {
    expect(estadoDeRecurso([], [{ estado: 'En remediación' }])).toBe('Advertencia')
  })

  it('un hallazgo cerrado ya no afecta', () => {
    expect(estadoDeRecurso([], [{ estado: 'Cerrado' }])).toBe('Conforme')
  })

  it('una excepción vigente tampoco', () => {
    expect(estadoDeRecurso([], [{ estado: 'Excepción' }])).toBe('Conforme')
  })
})

describe('ruta de recursos', () => {
  let app: Awaited<ReturnType<typeof construirApp>>

  beforeAll(async () => {
    app = await construirApp({ config: cargarConfig({ NIVEL_LOG: 'fatal' }) })
    await app.ready()
  })

  const pedir = async (query = '') =>
    (await app.inject({ method: 'GET', url: `${PREFIJO}/recursos${query}` })).json()

  it('a la VPC no se le exigen etiquetas', async () => {
    const { recursos } = await pedir()
    const vpc = recursos.find((r: { nombre: string }) => r.nombre === 'vpc-mdc-prod')
    expect(vpc.etiquetasFaltantes).toEqual([])
    expect(vpc.estado).toBe('Conforme')
  })

  it('la cobertura se mide sobre los recursos etiquetables', async () => {
    const { recursos, resumen } = await pedir()
    expect(resumen.etiquetables).toBeLessThan(recursos.length)
    expect(resumen.coberturaEtiquetas).toBeGreaterThan(50)
  })

  it('marca no conforme el recurso con hallazgo abierto', async () => {
    const { recursos } = await pedir()
    const firewall = recursos.find((r: { nombre: string }) => r.nombre === 'fw-allow-ssh')
    expect(firewall.estado).toBe('No conforme')
  })

  it('marca sin etiqueta al que le falta una clave', async () => {
    const { recursos } = await pedir()
    const secreto = recursos.find((r: { nombre: string }) => r.nombre === 'sm-app-secrets')
    expect(secreto.estado).toBe('Sin etiqueta')
    expect(secreto.etiquetasFaltantes).toEqual(['centro_costos'])
  })

  it('el que está en remediación sale como advertencia', async () => {
    const { recursos } = await pedir()
    const sql = recursos.find((r: { nombre: string }) => r.nombre === 'sql-mdc-qa-01')
    expect(sql.estado).toBe('Advertencia')
  })

  it('filtra por módulo', async () => {
    const { recursos } = await pedir('?modulo=network')
    expect(recursos.length).toBeGreaterThan(0)
    for (const r of recursos) expect(r.modulo).toBe('network')
  })

  it('busca por nombre', async () => {
    const { recursos } = await pedir('?buscar=ssh')
    expect(recursos.map((r: { nombre: string }) => r.nombre)).toEqual(['fw-allow-ssh'])
  })

  // Una búsqueda no debe cambiar la cobertura del ambiente.
  it('el resumen no depende del filtro', async () => {
    const sinFiltro = await pedir()
    const filtrado = await pedir('?buscar=ssh')
    expect(filtrado.resumen).toEqual(sinFiltro.resumen)
    expect(filtrado.recursos.length).toBeLessThan(sinFiltro.recursos.length)
  })

  // La cobertura se mide sobre los etiquetables, así que la comprobación es
  // la coherencia aritmética del propio resumen.
  it('la cobertura concuerda con las cifras que la acompañan', async () => {
    const { resumen } = await pedir()
    expect(resumen.conEtiquetasCompletas).toBeLessThanOrEqual(resumen.etiquetables)
    expect(resumen.etiquetables).toBeLessThanOrEqual(resumen.total)
    const esperada =
      Math.round((resumen.conEtiquetasCompletas / resumen.etiquetables) * 1000) / 10
    expect(resumen.coberturaEtiquetas).toBe(esperada)
  })
})
