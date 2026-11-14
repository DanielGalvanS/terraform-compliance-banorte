import type { User } from '../model'

/** Demo identity returned by the prototype sign-in. */
export const demoUser: User = {
  name: 'Ana Martínez',
  email: 'ana.martinez@banco.mx',
  role: 'Compliance Lead',
  initials: 'AM',
}

/**
 * Credenciales precargadas del prototipo.
 *
 * El valor es deliberadamente trivial. La pantalla de acceso no valida nada
 * —`authRepository.signIn` acepta cualquier par no vacío— así que una cadena
 * con aspecto de contraseña real solo lograría dos cosas: que el escáner de
 * secretos del pipeline la marcara, y que alguien creyera que significa algo.
 */
export const demoCredentials = {
  email: 'ana.martinez@banco.mx',
  password: 'demo',
}
