import { writeFile } from 'node:fs/promises'
import { construirApp } from './app.ts'
import { cargarConfig } from './config.ts'

/**
 * Vuelca el contrato OpenAPI a un archivo, sin abrir ningún puerto.
 *
 * El frontend genera sus tipos de aquí, así que el contrato se versiona: un
 * cambio en la API aparece en el diff del pull request en vez de descubrirse
 * cuando algo deja de funcionar.
 */
const app = await construirApp({ config: cargarConfig({ ...process.env, NIVEL_LOG: 'fatal' }) })
await app.ready()
await writeFile('openapi.json', `${JSON.stringify(app.swagger(), null, 2)}\n`)
await app.close()
console.log('openapi.json actualizado')
