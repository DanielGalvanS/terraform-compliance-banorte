import { z } from 'zod'

/**
 * Configuración del proceso. Se valida al arrancar: un servicio que arranca
 * con una variable mal puesta falla más tarde y más lejos del error.
 */
const esquema = z.object({
  PUERTO: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('127.0.0.1'),
  NIVEL_LOG: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /**
   * Catálogo de controles. Es el MISMO archivo que evalúa la compuerta de
   * políticas: si la API tuviera su propia copia, podrían discrepar y la
   * pantalla mostraría controles que no bloquean nada.
   */
  RUTA_CATALOGO: z.string().default('../../infra/policies/mappings.yaml'),
  /** Orígenes del navegador autorizados, separados por coma. */
  ORIGENES_PERMITIDOS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform((valor) => valor.split(',').map((o) => o.trim()).filter(Boolean)),
  /** Ausente mientras no exista la base; los repositorios usan memoria. */
  DATABASE_URL: z.string().optional(),
  /**
   * Bucket con retención donde se escribe la evidencia (módulo
   * infra/modules/logging). Sin él, la evidencia vive en memoria: detecta una
   * alteración, pero no la impide ni sobrevive a un reinicio.
   */
  EVIDENCIA_BUCKET: z.string().min(3).optional(),
  /**
   * `local` firma y verifica tokens con un secreto propio y habilita los
   * usuarios de demostración. `jwks` verifica tokens del proveedor de
   * identidad con sus llaves públicas; es el modo de cualquier ambiente real.
   */
  AUTH_MODO: z.enum(['local', 'jwks']).default('local'),
  /**
   * Secreto de los tokens locales. Si falta, se genera uno al azar en cada
   * arranque: los tokens de /sesion funcionan, pero no sobreviven a un
   * reinicio. Se fija solo para emitir tokens de servicio con `npm run token`.
   */
  AUTH_SECRETO: z.string().min(32, 'AUTH_SECRETO necesita al menos 32 caracteres').optional(),
  AUTH_JWKS_URL: z.url().optional(),
  AUTH_EMISOR: z.string().optional(),
  AUTH_AUDIENCIA: z.string().optional(),
}).superRefine((c, contexto) => {
  // Los usuarios de demostración aceptan una contraseña conocida. Junto a
  // datos reales serían una puerta abierta, así que esa combinación no arranca.
  if (c.AUTH_MODO === 'local' && c.DATABASE_URL !== undefined) {
    contexto.addIssue({
      code: 'custom',
      path: ['AUTH_MODO'],
      message: 'El modo local no se permite con base de datos real; usa AUTH_MODO=jwks',
    })
  }
  if (c.AUTH_MODO === 'jwks') {
    for (const campo of ['AUTH_JWKS_URL', 'AUTH_EMISOR', 'AUTH_AUDIENCIA'] as const) {
      if (c[campo] === undefined) {
        contexto.addIssue({ code: 'custom', path: [campo], message: 'Obligatorio con AUTH_MODO=jwks' })
      }
    }
  }
})

export type Config = z.infer<typeof esquema>

export function cargarConfig(entorno: NodeJS.ProcessEnv = process.env): Config {
  const resultado = esquema.safeParse(entorno)
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Configuración inválida:\n${detalle}`)
  }
  return resultado.data
}
