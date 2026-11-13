import type { User } from '../model'

/** Demo identity returned by the prototype sign-in. */
export const demoUser: User = {
  name: 'Ana Martínez',
  email: 'ana.martinez@banco.mx',
  role: 'Compliance Lead',
  initials: 'AM',
}

export const demoCredentials = {
  email: 'ana.martinez@banco.mx',
  password: 'Compliance2025',
}
