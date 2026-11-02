import { useCallback, useEffect, useRef, useState } from 'react'

/** How long the simulated run takes before results come back. */
const RUN_DURATION_MS = 2200

/**
 * Drives the "running" state of a performance test. The timer is owned here so
 * the page stays declarative and nothing leaks after unmount.
 */
export function useTestRun(durationMs = RUN_DURATION_MS) {
  const [isRunning, setIsRunning] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const start = useCallback(() => {
    window.clearTimeout(timer.current)
    setIsRunning(true)
    timer.current = window.setTimeout(() => setIsRunning(false), durationMs)
  }, [durationMs])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { isRunning, start }
}
