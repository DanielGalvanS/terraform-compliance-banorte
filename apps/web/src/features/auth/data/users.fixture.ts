import type { User } from '../model'

/** Demo identity returned by the prototype sign-in. */
export const demoUser: User = {
  name: 'Ana Martínez',
  email: 'compliance@banorte.mx',
  role: 'Compliance Lead',
  initials: 'AM',
  permissions: null,
}

/**
 * Cuentas de demostración de la API, una por rol. Son las de
 * `apps/api/src/repositorios/usuariosDemo.ts`; aquí solo sirven para
 * precargar el correo al elegir un rol en la pantalla de acceso.
 */
export const demoAccounts = [
  { email: 'compliance@banorte.mx', role: 'Compliance Lead' },
  { email: 'aprobador@banorte.mx', role: 'Aprobador' },
  { email: 'desarrollador@banorte.mx', role: 'Desarrollador' },
  { email: 'auditor@banorte.mx', role: 'Auditor' },
] as const

/**
 * Credenciales precargadas del prototipo.
 *
 * El valor es deliberadamente trivial. La pantalla de acceso no valida nada
 * —`authRepository.signIn` acepta cualquier par no vacío— así que una cadena
 * con aspecto de contraseña real solo lograría dos cosas: que el escáner de
 * secretos del pipeline la marcara, y que alguien creyera que significa algo.
 */
export const demoCredentials = {
  email: 'compliance@banorte.mx',
  password: 'demo',
}
