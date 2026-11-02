import complianceLogo from '@/assets/compliance-logo.jpeg'
import { useNavigation } from '@/shared/navigation'
import { Icon } from '@/shared/ui'
import { routes } from '../routes'

const APP_VERSION = 'Compliance Ops · v2.4.1'

export function Sidebar() {
  const { current, navigate } = useNavigation()

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <img src={complianceLogo} alt="" />
        </div>
        <div>
          <strong>Compliance</strong>
          <small>OPS</small>
        </div>
      </div>
      <div className="org-label">PLATAFORMA</div>
      <nav>
        {routes.map((route) => (
          <button
            key={route.id}
            type="button"
            className={current === route.id ? 'active' : ''}
            aria-current={current === route.id ? 'page' : undefined}
            onClick={() => navigate(route.id)}
          >
            <Icon name={route.icon} />
            <span>{route.label}</span>
            {route.badge && <b>{route.badge}</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="security-state">
          <span>
            <Icon name="shield" size={16} />
          </span>
          <div>
            <strong>Postura segura</strong>
            <small>Último escaneo: 3 min</small>
          </div>
        </div>
        <button className="help-link" type="button">
          <span>?</span>Centro de ayuda
        </button>
        <div className="version">{APP_VERSION}</div>
      </div>
    </aside>
  )
}
