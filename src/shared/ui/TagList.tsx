export type Tag = {
  text: string
  /** Marks a required tag that is absent on the resource. */
  missing?: boolean
}

type TagListProps = {
  tags: Tag[]
}

export function TagList({ tags }: TagListProps) {
  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span key={tag.text} className={tag.missing ? 'missing' : undefined}>
          {tag.text}
        </span>
      ))}
    </div>
  )
}
