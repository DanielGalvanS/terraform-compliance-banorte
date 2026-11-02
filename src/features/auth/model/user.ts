export type User = {
  name: string
  email: string
  role: string
  /** Pre-computed avatar text; the fixture owns it so the UI never parses names. */
  initials: string
}

export type Credentials = {
  email: string
  password: string
}
