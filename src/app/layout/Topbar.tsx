import { useNavigation } from '@/shared/navigation'
import { Icon } from '@/shared/ui'
import { findRoute } from '../routes'
import { EnvironmentSwitch } from './EnvironmentSwitch'
import { NotificationsMenu } from './NotificationsMenu'
import { UserMenu } from './UserMenu'

const ORGANIZATION = 'Banco Nacional'

export function Topbar() {
  const { current } = useNavigation()
  const route = findRoute(current)

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>{ORGANIZATION}</span>
        <Icon name="chevron" size={13} />
        <strong>{route?.label}</strong>
      </div>
      <div className="top-actions">
        <EnvironmentSwitch />
        <label className="global-search">
          <Icon name="search" size={17} />
          <input placeholder="Buscar recurso, PR, control…" aria-label="Búsqueda global" />
          <kbd>⌘ K</kbd>
        </label>
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  )
}
