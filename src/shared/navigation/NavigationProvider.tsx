import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type NavigationContextValue = {
  /** Identifier of the page currently shown. */
  current: string
  navigate: (target: string) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

function readHash(): string {
  return window.location.hash.replace(/^#\/?/, '')
}

type NavigationProviderProps = {
  children: ReactNode
  /** Route shown when the URL carries no (or an unknown) fragment. */
  fallback: string
  isKnown: (target: string) => boolean
}

/**
 * Hash-based navigation. It keeps pages addressable and the back button
 * working without pulling in a routing library, and stays agnostic of which
 * routes exist — the app layer supplies `isKnown`.
 */
export function NavigationProvider({ children, fallback, isKnown }: NavigationProviderProps) {
  const [current, setCurrent] = useState(() => {
    const initial = readHash()
    return isKnown(initial) ? initial : fallback
  })

  useEffect(() => {
    const sync = () => {
      const next = readHash()
      setCurrent(isKnown(next) ? next : fallback)
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [fallback, isKnown])

  const navigate = useCallback((target: string) => {
    window.location.hash = `#/${target}`
  }, [])

  const value = useMemo(() => ({ current, navigate }), [current, navigate])

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext)
  if (!context) throw new Error('useNavigation must be used inside <NavigationProvider>')
  return context
}
