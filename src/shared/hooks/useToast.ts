import { useCallback, useEffect, useRef, useState } from 'react'

const TOAST_DURATION_MS = 2600

/**
 * Single transient confirmation message per page. The timer is cleared on
 * unmount and on every new message, so a quick sequence of actions never
 * leaves a toast stuck on screen.
 */
export function useToast(durationMs = TOAST_DURATION_MS) {
  const [message, setMessage] = useState('')
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback(
    (next: string) => {
      window.clearTimeout(timer.current)
      setMessage(next)
      timer.current = window.setTimeout(() => setMessage(''), durationMs)
    },
    [durationMs],
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { message, show }
}
