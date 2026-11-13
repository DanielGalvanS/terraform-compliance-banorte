import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = {
  children: ReactNode
  variant?: ButtonVariant
  icon?: IconName
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function Button({
  children,
  variant = 'primary',
  icon,
  onClick,
  disabled,
  type = 'button',
}: ButtonProps) {
  return (
    <button type={type} className={`button ${variant}`} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  )
}

type IconButtonProps = {
  icon: IconName
  label: string
  size?: number
  className?: string
  onClick?: () => void
}

/** Square, borderless control used for close / filter / download affordances. */
export function IconButton({ icon, label, size = 18, className = '', onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`.trim()}
      aria-label={label}
      onClick={onClick}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

type LinkButtonProps = {
  children: ReactNode
  onClick?: () => void
}

/** Inline "ver todo" style affordance inside card headers. */
export function LinkButton({ children, onClick }: LinkButtonProps) {
  return (
    <button type="button" className="link-button" onClick={onClick}>
      {children} <Icon name="arrow" size={14} />
    </button>
  )
}
