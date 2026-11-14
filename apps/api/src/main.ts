import { cargarConfig } from './config.ts'
import { construirApp } from './app.ts'

const config = cargarConfig()
const app = await construirApp({ config })

try {
  await app.listen({ port: config.PUERTO, host: config.HOST })
} catch (causa) {
  app.log.error(causa)
  process.exit(1)
}

// Cierre ordenado: permite terminar las peticiones en curso antes de salir,
// que es lo que espera Cloud Run al reciclar una instancia.
for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(senal, () => {
    app.log.info(`${senal} recibida, cerrando`)
    void app.close().then(() => process.exit(0))
  })
}
