import fastifyCors from '@fastify/cors'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import Fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { Config } from './config.ts'
import { cargarCatalogo } from './repositorios/catalogoRepositorio.ts'
import {
  repositorioEnMemoria,
  type HallazgosRepositorio,
} from './repositorios/hallazgosRepositorio.ts'
import { hallazgosDeEjemplo } from './repositorios/semilla.ts'
import { rutasCatalogo } from './rutas/catalogo.ts'
import { rutasHallazgos } from './rutas/hallazgos.ts'
import { rutasResumen } from './rutas/resumen.ts'

export const PREFIJO = '/api/v1'

type Opciones = {
  config: Config
  /** Permite inyectar otro repositorio en las pruebas. */
  hallazgos?: HallazgosRepositorio
}

/**
 * Construye el servidor sin arrancarlo.
 *
 * Separarlo de `main.ts` permite que las pruebas lo levanten en memoria con
 * `app.inject()`, sin abrir un puerto ni depender del entorno.
 */
export async function construirApp({ config, hallazgos }: Opciones) {
  const app = Fastify({ logger: { level: config.NIVEL_LOG } }).withTypeProvider<ZodTypeProvider>()

  // El frontend se sirve desde otro origen en desarrollo. La lista es
  // explícita: un '*' abriría la API a cualquier página del navegador.
  await app.register(fastifyCors, {
    origin: config.ORIGENES_PERMITIDOS,
    methods: ['GET', 'POST'],
    allowedHeaders: ['content-type', 'idempotency-key'],
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Compliance Ops API',
        description:
          'Lectura de la postura de cumplimiento y registro de hallazgos. El catálogo ' +
          'de controles se sirve desde infra/policies/mappings.yaml, el mismo archivo ' +
          'que evalúa la compuerta del pipeline.',
        version: '0.1.0',
      },
      servers: [{ url: PREFIJO }],
    },
    transform: jsonSchemaTransform,
  })
  await app.register(fastifySwaggerUi, { routePrefix: '/documentacion' })

  const catalogo = await cargarCatalogo(config.RUTA_CATALOGO)
  const repositorio = hallazgos ?? repositorioEnMemoria(hallazgosDeEjemplo)

  app.get(
    '/salud',
    {
      schema: {
        summary: 'Comprobación de vida',
        tags: ['operación'],
        response: {
          200: z.object({
            estado: z.literal('ok'),
            catalogo: z.string().describe('Versión del catálogo cargado'),
            // Mientras sea false, los datos son de ejemplo y no deben
            // confundirse con la postura real.
            persistencia: z.boolean(),
          }),
        },
      },
    },
    async () => ({
      estado: 'ok' as const,
      catalogo: catalogo.version,
      persistencia: config.DATABASE_URL !== undefined,
    }),
  )

  await app.register(rutasCatalogo(catalogo), { prefix: PREFIJO })
  await app.register(rutasHallazgos(repositorio), { prefix: PREFIJO })
  await app.register(rutasResumen(catalogo, repositorio), { prefix: PREFIJO })

  return app
}
