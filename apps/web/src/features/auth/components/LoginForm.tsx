import { useState, type FormEvent } from 'react'
import { hayApi } from '@/shared/api'
import { Button, Icon } from '@/shared/ui'
import { authRepository } from '../api/authRepository'
import { useAuth } from '../state/AuthProvider'

export function LoginForm() {
  const { signIn, signInWithSso } = useAuth()
  const [credentials, setCredentials] = useState(authRepository.getPrefilledCredentials())
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEnviando(true)
    try {
      if (await signIn(credentials)) {
        setError('')
        return
      }
      setError(
        hayApi
          ? 'Correo o contraseña incorrectos.'
          : 'Ingresa tu correo institucional y contraseña.',
      )
    } catch {
      setError('No se pudo contactar con la API. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="login-access">
      <div className="login-form-wrap">
        <div className="login-form-icon">
          <Icon name="lock" size={20} />
        </div>
        <span className="login-form-kicker">ACCESO INTERNO</span>
        <h2>Bienvenido a Compliance Ops</h2>
        <p className="login-form-description">
          Ingresa con tus credenciales institucionales para continuar.
        </p>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            <span>Correo institucional</span>
            <input
              type="email"
              value={credentials.email}
              onChange={(event) =>
                setCredentials((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="nombre@banorte.mx"
              autoComplete="username"
            />
          </label>
          <label>
            <span>Contraseña</span>
            <input
              type="password"
              value={credentials.password}
              onChange={(event) =>
                setCredentials((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Ingresa tu contraseña"
              autoComplete="current-password"
            />
          </label>
          <div className="login-options">
            <label className="login-checkbox">
              <input type="checkbox" defaultChecked />
              <span>Recordar este equipo</span>
            </label>
            <button type="button">¿Olvidaste tu contraseña?</button>
          </div>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" icon="arrow" disabled={enviando}>
            {enviando ? 'Verificando…' : 'Iniciar sesión'}
          </Button>
        </form>

        {/* Con API el SSO lo dará el proveedor de identidad; hoy no existe. */}
        {!hayApi && (
          <>
            <div className="login-divider">
              <span>o continúa con</span>
            </div>
            <button className="sso-button" type="button" onClick={signInWithSso}>
              <span className="sso-symbol">M</span>
              Microsoft Entra ID
            </button>
          </>
        )}

        <div className="demo-access">
          <Icon name="shield" size={15} />
          <span>
            <strong>Acceso de demostración</strong>
            <small>
              {hayApi
                ? 'Elige un rol para probar sus permisos. La contraseña de todos es «demo».'
                : 'Las credenciales ya están cargadas para el prototipo.'}
            </small>
          </span>
        </div>
        {hayApi && (
          <div className="demo-roles" role="group" aria-label="Entrar con un rol de demostración">
            {authRepository.demoAccounts.map((cuenta) => (
              <button
                key={cuenta.email}
                type="button"
                className="sso-button"
                aria-pressed={credentials.email === cuenta.email}
                onClick={() => setCredentials({ email: cuenta.email, password: 'demo' })}
              >
                {cuenta.role}
              </button>
            ))}
          </div>
        )}
      </div>
      <footer className="login-footer">
        <span>Uso exclusivo de personal autorizado</span>
        <span>Compliance Ops · v2.4.1</span>
      </footer>
    </section>
  )
}
