import complianceLogo from '@/assets/compliance-logo.jpeg'
import { Icon } from '@/shared/ui'

/** The three-step promise shown beside the sign-in form. */
const PIPELINE_STEPS = [
  { step: '01', title: 'Código', detail: 'Terraform validado' },
  { step: '02', title: 'Control', detail: 'Políticas evaluadas' },
  { step: '03', title: 'Evidencia', detail: 'Auditoría lista' },
]

export function LoginBrandPanel() {
  return (
    <section className="login-visual">
      <div className="login-brand">
        <div className="login-brand-mark">
          <img src={complianceLogo} alt="" />
        </div>
        <div>
          <strong>Compliance</strong>
          <small>OPS</small>
        </div>
      </div>
      <div className="login-intro">
        <span className="login-kicker">GOBIERNO DE INFRAESTRUCTURA</span>
        <h1>
          Despliegues seguros.
          <br />
          Evidencia continua.
        </h1>
        <p>
          Supervisa cada cambio de infraestructura, automatiza controles y conserva la
          trazabilidad de punta a punta.
        </p>
        <div className="login-flow">
          {PIPELINE_STEPS.map((item) => (
            <div key={item.step}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="login-security">
        <Icon name="shield" size={16} />
        <span>
          <strong>Entorno bancario protegido</strong>
          <small>Acceso monitoreado y cifrado</small>
        </span>
      </div>
    </section>
  )
}
