import { useCallback, useState } from 'react'
import { exceptionsRepository } from '../api/exceptionsRepository'
import type { ComplianceException, NewExceptionInput } from '../model'

/**
 * Owns the exception register for the session. Submitting the form prepends a
 * pending request, which is what a real create-then-refetch would show.
 */
export function useExceptions(requestedBy: string) {
  const [items, setItems] = useState<ComplianceException[]>(() => exceptionsRepository.list())

  const create = useCallback(
    (input: NewExceptionInput) => {
      setItems((current) => [exceptionsRepository.build(input, current, requestedBy), ...current])
    },
    [requestedBy],
  )

  return { items, create }
}
