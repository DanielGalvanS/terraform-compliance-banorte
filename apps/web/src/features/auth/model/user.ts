export type User = {
  name: string
  email: string
  role: string
  /** Pre-computed avatar text; the fixture owns it so the UI never parses names. */
  initials: string
  /**
   * Acciones que la API permite a este rol, tal como las devuelve /sesion.
   * Null sin API: el prototipo no aplica permisos y muestra todo.
   */
  permissions: string[] | null
}

/** Si la pantalla debe ofrecer una acción. La API vuelve a comprobarlo. */
export function can(user: User | null, accion: string): boolean {
  if (user === null) return false
  return user.permissions === null || user.permissions.includes(accion)
}

export type Credentials = {
  email: string
  password: string
}
