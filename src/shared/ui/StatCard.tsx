import type { ReactNode } from 'react'
import { Card } from './Card'

type StatCardProps = {
  label: string
  value: ReactNode
  /** Small print under the value. */
  footnote?: ReactNode
  footnoteClassName?: string
}

/** Label / value / footnote tile used in the summary rows above a table. */
export function StatCard({ label, value, footnote, footnoteClassName }: StatCardProps) {
  return (
    <Card>
      <span>{label}</span>
      <strong>{value}</strong>
      {footnote !== undefined &&
        (typeof footnote === 'string' ? (
          <small className={footnoteClassName}>{footnote}</small>
        ) : (
          footnote
        ))}
    </Card>
  )
}
