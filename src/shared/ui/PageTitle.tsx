import type { ReactNode } from 'react'

type PageTitleProps = {
  eyebrow?: string
  title: string
  description: string
  action?: ReactNode
}

export function PageTitle({ eyebrow, title, description, action }: PageTitleProps) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  )
}
