import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return <section className={`card ${className}`.trim()}>{children}</section>
}

type CardHeaderProps = {
  title: string
  subtitle?: string
  /** Badge, label or control pinned to the right of the header. */
  aside?: ReactNode
  compact?: boolean
}

export function CardHeader({ title, subtitle, aside, compact }: CardHeaderProps) {
  return (
    <div className={`card-head ${compact ? 'compact' : ''}`.trim()}>
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {aside}
    </div>
  )
}
