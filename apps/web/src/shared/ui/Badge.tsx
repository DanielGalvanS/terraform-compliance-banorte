import type { ReactNode } from 'react'
import type { Tone } from '@/shared/model'

type BadgeProps = {
  children: ReactNode
  tone?: Tone
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  )
}
