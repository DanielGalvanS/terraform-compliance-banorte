import type { ReactNode } from 'react'
import { useEscapeKey } from '@/shared/hooks'
import { IconButton } from './Button'

type DrawerProps = {
  /** Title block: badge, heading and identifier, composed by the caller. */
  header: ReactNode
  children: ReactNode
  /** Sticky action row at the bottom of the panel. */
  footer?: ReactNode
  className?: string
  onClose: () => void
}

/** Right-hand detail panel with a click-away backdrop and Escape to close. */
export function Drawer({ header, children, footer, className = '', onClose }: DrawerProps) {
  useEscapeKey(onClose)

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className={`drawer ${className}`.trim()}>
        <div className="drawer-head">
          <div>{header}</div>
          <IconButton icon="close" label="Cerrar panel" onClick={onClose} />
        </div>
        {children}
        {footer && <div className="drawer-actions">{footer}</div>}
      </aside>
    </>
  )
}
