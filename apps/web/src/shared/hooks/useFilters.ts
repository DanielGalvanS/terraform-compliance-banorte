import { useCallback, useMemo, useState } from 'react'

export type FilterValues<K extends string> = Record<K, string>

/**
 * Filter-bar state with a stable reset. Callers own the predicate, so a page
 * decides how each value narrows its rows while the plumbing stays here.
 */
export function useFilters<K extends string>(initial: FilterValues<K>) {
  const [values, setValues] = useState<FilterValues<K>>(initial)

  const set = useCallback((key: K, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
  }, [])

  const reset = useCallback(() => setValues(initial), [initial])

  const isDefault = useMemo(
    () => (Object.keys(initial) as K[]).every((key) => values[key] === initial[key]),
    [initial, values],
  )

  return { values, set, reset, isDefault }
}
