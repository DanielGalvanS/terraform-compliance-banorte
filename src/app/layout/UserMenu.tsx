import { useAuth } from '@/features/auth'
import { useDisclosure } from '@/shared/hooks'
import { Icon } from '@/shared/ui'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const { isOpen, toggle, close } = useDisclosure()

  if (!user) return null

  return (
    <div className="popover-wrap">
      <button type="button" className="user-button" aria-expanded={isOpen} onClick={toggle}>
        <span className="avatar">{user.initials}</span>
        <span>
          <strong>{user.name}</strong>
          <small>{user.role}</small>
        </span>
        <Icon name="chevron" size={14} />
      </button>
      {isOpen && (
        <div className="popover profile">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
          <hr />
          <button type="button">Mi perfil</button>
          <button type="button">Configuración</button>
          <button
            type="button"
            onClick={() => {
              close()
              signOut()
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
