import { useDisclosure } from '@/shared/hooks'
import { Icon } from '@/shared/ui'

type Notification = {
  id: string
  title: string
  meta: string
  /** Critical items get the red dot, everything else the blue one. */
  critical?: boolean
}

const notifications: Notification[] = [
  { id: 'pr-142', title: 'PR #142 bloqueado', meta: 'Hace 8 minutos', critical: true },
  { id: 'apr-881', title: 'Aprobación pendiente', meta: 'APR-881 · Producción' },
]

export function NotificationsMenu() {
  const { isOpen, toggle } = useDisclosure()

  return (
    <div className="popover-wrap">
      <button
        type="button"
        className="top-icon"
        aria-label="Notificaciones"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        <Icon name="bell" />
        <span />
      </button>
      {isOpen && (
        <div className="popover notifications">
          <strong>Notificaciones</strong>
          {notifications.map((notification) => (
            <div key={notification.id}>
              <span className={notification.critical ? 'critical-dot' : 'blue-dot'} />
              <p>
                <b>{notification.title}</b>
                <small>{notification.meta}</small>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
