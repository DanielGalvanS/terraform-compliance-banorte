import { parseArgs } from 'node:util'
import { emitirTokenLocal } from './auth/verificador.ts'
import { cargarConfig } from './config.ts'
import { Rol } from './model/esquemas.ts'
import { serviciosDemo, usuariosDemo } from './repositorios/usuariosDemo.ts'

/**
 * Emite un token local para un servicio o un usuario de demostración.
 *
 *   AUTH_SECRETO=… npm run token --workspace @compliance-ops/api -- --rol Agente
 *
 * Lo usan el agente y el pipeline en desarrollo. Exige AUTH_SECRETO fijo: con
 * el secreto al azar de cada arranque, el token no serviría contra la API que
 * está corriendo. Con un proveedor de identidad real no aplica: los servicios
 * usan el token de su cuenta de servicio.
 */
const { values } = parseArgs({
  options: {
    rol: { type: 'string' },
    duracion: { type: 'string', default: '12h' },
  },
})

const config = cargarConfig()
if (config.AUTH_MODO !== 'local') {
  console.error('npm run token solo funciona con AUTH_MODO=local')
  process.exit(1)
}
if (config.AUTH_SECRETO === undefined) {
  console.error('Fija AUTH_SECRETO, el mismo con el que arranca la API')
  process.exit(1)
}

const rol = Rol.safeParse(values.rol)
if (!rol.success) {
  console.error(`--rol debe ser uno de: ${Rol.options.join(', ')}`)
  process.exit(1)
}

const identidad =
  rol.data === 'Agente' || rol.data === 'Pipeline'
    ? serviciosDemo[rol.data]
    : usuariosDemo.find((u) => u.rol === rol.data)!

console.log(await emitirTokenLocal(config.AUTH_SECRETO, identidad, values.duracion))
