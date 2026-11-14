import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Environment } from '@/shared/model'

type EnvironmentContextValue = {
  environment: Environment
  setEnvironment: (environment: Environment) => void
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null)

/**
 * The environment selected in the top bar. It is app-wide state because
 * several features default to it (new exceptions, pipeline scope), so it
 * cannot live inside any single page.
 */
export function EnvironmentProvider({
  children,
  initial = 'Prod',
}: {
  children: ReactNode
  initial?: Environment
}) {
  const [environment, setEnvironment] = useState<Environment>(initial)
  const value = useMemo(() => ({ environment, setEnvironment }), [environment])
  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>
}

export function useEnvironment(): EnvironmentContextValue {
  const context = useContext(EnvironmentContext)
  if (!context) throw new Error('useEnvironment must be used inside <EnvironmentProvider>')
  return context
}
