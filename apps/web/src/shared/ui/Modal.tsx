import type { ReactNode } from 'react'
import { useEscapeKey } from '@/shared/hooks'
import { IconButton } from './Button'

type ModalProps = {
  children: ReactNode
  className?: string
  onClose: () => void
  /** Renders the corner dismiss control; confirmation dialogs leave it out. */
  showCloseButton?: boolean
}

export function Modal({ children, className = '', onClose, showCloseButton }: ModalProps) {
  useEscapeKey(onClose)

  return (
    <div className="modal-layer">
      <div className={`modal ${className}`.trim()} role="dialog" aria-modal="true">
        {showCloseButton && (
          <IconButton
            icon="close"
            label="Cerrar"
            className="modal-close"
            onClick={onClose}
          />
        )}
        {children}
      </div>
    </div>
  )
}
