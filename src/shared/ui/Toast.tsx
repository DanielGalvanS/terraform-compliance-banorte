import { Icon } from './Icon'

type ToastProps = {
  message: string
}

/** Renders nothing when there is no message, so pages can mount it freely. */
export function Toast({ message }: ToastProps) {
  if (!message) return null
  return (
    <div className="toast" role="status">
      <Icon name="check" />
      {message}
    </div>
  )
}
