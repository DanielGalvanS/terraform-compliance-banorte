import { useEffect } from 'react'

/** Closes transient layers (drawers, modals, popovers) with the Escape key. */
export function useEscapeKey(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape, active])
}
