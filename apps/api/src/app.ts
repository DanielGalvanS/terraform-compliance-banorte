import { randomBytes } from 'node:crypto'
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
import { registrarAutenticacion } from './auth/autorizacion.ts'
import { verificadorJwks, verificadorLocal, type Verificador } from './auth/verificador.ts'
import type { Config } from './config.ts'
import { cargarCatalogo } from './repositorios/catalogoRepositorio.ts'
import {
  evidenciaEnMemoria,
  type EvidenciaRepositorio,
} from './repositorios/evidenciaRepositorio.ts'
import {
  excepcionesEnMemoria,
  type ExcepcionesRepositorio,
} from './repositorios/excepcionesRepositorio.ts'
import {
  repositorioEnMemoria,
  type HallazgosRepositorio,
} from './repositorios/hallazgosRepositorio.ts'
import {
  excepcionesDeEjemplo,
  hallazgosDeEjemplo,
  recursosDeEjemplo,
} from './repositorios/semilla.ts'
import { rutasCatalogo } from './rutas/catalogo.ts'
import { rutasEvidencia } from './rutas/evidencia.ts'
import { rutasExcepciones } from './rutas/excepciones.ts'
import { rutasRecursos } from './rutas/recursos.ts'
import { rutasHallazgos } from './rutas/hallazgos.ts'
import { rutasResumen } from './rutas/resumen.ts'
import { rutasSesion } from './rutas/sesion.ts'

export const PREFIJO = '/api/v1'

type Opciones = {
  config: Config
  /** Permiten inyectar otros repositorios en las pruebas. */
  hallazgos?: HallazgosRepositorio
  excepciones?: ExcepcionesRepositorio
  evidencia?: EvidenciaRepositorio
  verificador?: Verificador
}

/**
 * Construye el servidor sin arrancarlo.
 *
 * Separarlo de `main.ts` permite que las pruebas lo levanten en memoria con
 * `app.inject()`, sin abrir un puerto ni depender del entorno.
 */
/**
 * El secreto de los tokens locales. Si no se fijó, uno al azar por proceso:
 * un secreto escrito en el código sería el mismo en todas las copias del
 * repositorio, y cualquiera podría firmar tokens válidos.
 */
export function secretoLocal(config: Config): string {
  return config.AUTH_SECRETO ?? randomBytes(32).toString('hex')
}

function construirVerificador(config: Config, secreto: string): Verificador {
  if (config.AUTH_MODO === 'jwks') {
    return verificadorJwks({
      // cargarConfig ya exige los tres en modo jwks.
      url: config.AUTH_JWKS_URL!,
      emisor: config.AUTH_EMISOR!,
      audiencia: config.AUTH_AUDIENCIA!,
    })
  }
  return verificadorLocal(secreto)
}

export async function construirApp({
  config,
  hallazgos,
  excepciones,
  evidencia,
  verificador,
}: Opciones) {
  const app = Fastify({ logger: { level: config.NIVEL_LOG } }).withTypeProvider<ZodTypeProvider>()

  // El frontend se sirve desde otro origen en desarrollo. La lista es
  // explícita: un '*' abriría la API a cualquier página del navegador.
  await app.register(fastifyCors, {
    origin: config.ORIGENES_PERMITIDOS,
    // PATCH para cambiar el estado de un hallazgo. Si falta aquí, las pruebas
    // pasan (inject no aplica CORS) pero el navegador bloquea la petición.
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['content-type', 'idempotency-key', 'authorization'],
  })

  const secreto = secretoLocal(config)
  registrarAutenticacion(app, verificador ?? construirVerificador(config, secreto))

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
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      // Todo exige token salvo lo que se marca con `security: []`.
      security: [{ bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
  })
  await app.register(fastifySwaggerUi, { routePrefix: '/documentacion' })

  const catalogo = await cargarCatalogo(config.RUTA_CATALOGO)
  const repositorio = hallazgos ?? repositorioEnMemoria(hallazgosDeEjemplo)
  const repositorioExcepciones = excepciones ?? excepcionesEnMemoria(excepcionesDeEjemplo)
  // Sin semilla: la evidencia de ejemplo no probaría nada, y una cadena que
  // empieza vacía es la que se puede verificar desde el primer evento.
  const repositorioEvidencia = evidencia ?? evidenciaEnMemoria()

  app.get(
    '/salud',
    {
      schema: {
        summary: 'Comprobación de vida',
        tags: ['operación'],
        security: [],
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

  // Solo en modo local: con un proveedor de identidad, el login es suyo.
  if (config.AUTH_MODO === 'local') {
    await app.register(rutasSesion(secreto), { prefix: PREFIJO })
  }
  await app.register(rutasCatalogo(catalogo), { prefix: PREFIJO })
  await app.register(rutasHallazgos(repositorio, repositorioEvidencia), { prefix: PREFIJO })
  await app.register(rutasResumen(catalogo, repositorio), { prefix: PREFIJO })
  await app.register(rutasExcepciones(catalogo, repositorioExcepciones, repositorioEvidencia), { prefix: PREFIJO })
  await app.register(rutasEvidencia(repositorioEvidencia), { prefix: PREFIJO })
  await app.register(rutasRecursos(catalogo, recursosDeEjemplo, repositorio), { prefix: PREFIJO })

  return app
}
