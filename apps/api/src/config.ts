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
  /** Ausente mientras no exista la base; los repositorios usan memoria. */
  DATABASE_URL: z.string().optional(),
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
