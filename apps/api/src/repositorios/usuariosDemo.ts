import type { Identidad } from '../model/esquemas.ts'

/**
 * Usuarios de demostración, uno por rol de persona.
 *
 * Existen para poder probar los permisos sin un proveedor de identidad. La
 * contraseña es la misma para todos y es pública a propósito: esto no es
 * seguridad, es una forma de elegir con qué rol entrar. Por eso solo se
 * habilitan con AUTH_MODO=local, y la configuración impide ese modo junto a
 * una base de datos real.
 */
export const CONTRASENA_DEMO = 'demo'

export type UsuarioDemo = Identidad & { email: string; iniciales: string }

export const usuariosDemo: UsuarioDemo[] = [
  {
    sujeto: 'ana.martinez',
    nombre: 'Ana Martínez',
    rol: 'Compliance Lead',
    email: 'ana.martinez@banco.mx',
    iniciales: 'AM',
  },
  {
    sujeto: 'roberto.silva',
    nombre: 'Roberto Silva',
    rol: 'Aprobador',
    email: 'roberto.silva@banco.mx',
    iniciales: 'RS',
  },
  {
    sujeto: 'carlos.vega',
    nombre: 'Carlos Vega',
    rol: 'Desarrollador',
    email: 'carlos.vega@banco.mx',
    iniciales: 'CV',
  },
  {
    sujeto: 'lucia.ramos',
    nombre: 'Lucía Ramos',
    rol: 'Auditor',
    email: 'lucia.ramos@banco.mx',
    iniciales: 'LR',
  },
]

/**
 * Identidades de los servicios. No inician sesión: reciben un token emitido
 * con `npm run token`, y con GCP lo obtendrán de su cuenta de servicio.
 */
export const serviciosDemo: Record<'Agente' | 'Pipeline', Identidad> = {
  Agente: { sujeto: 'app-agente', nombre: 'Agente de cumplimiento', rol: 'Agente' },
  Pipeline: { sujeto: 'ci-plan', nombre: 'Pipeline', rol: 'Pipeline' },
}
