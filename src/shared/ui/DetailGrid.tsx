import type { ReactNode } from 'react'

export type DetailItem = {
  label: string
  value: ReactNode
  /** Optional second line under the value, e.g. a timestamp. */
  hint?: string
}

type DetailGridProps = {
  items: DetailItem[]
}

/** Two-column label/value grid used at the top of every detail panel. */
export function DetailGrid({ items }: DetailGridProps) {
  return (
    <div className="detail-grid">
      {items.map((item) => (
        <span key={item.label}>
          <small>{item.label}</small>
          {item.value}
          {item.hint && <small>{item.hint}</small>}
        </span>
      ))}
    </div>
  )
}

type DetailSectionProps = {
  title: string
  children: ReactNode
}

export function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}
