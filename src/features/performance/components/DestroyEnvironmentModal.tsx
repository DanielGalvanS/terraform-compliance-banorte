import { useState } from 'react'
import { Button, Icon, Modal } from '@/shared/ui'
import type { DestroyTarget } from '../model'

type DestroyEnvironmentModalProps = {
  target: DestroyTarget
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Typed confirmation for an irreversible action: the operator must spell the
 * confirmation word before the destructive button becomes available.
 */
export function DestroyEnvironmentModal({
  target,
  onCancel,
  onConfirm,
}: DestroyEnvironmentModalProps) {
  const [confirmation, setConfirmation] = useState('')
  const canDestroy = confirmation === target.confirmationWord

  return (
    <Modal onClose={onCancel}>
      <div className="modal-danger">
        <Icon name="trash" size={26} />
      </div>
      <h2>¿Destruir ambiente QA?</h2>
      <p>
        Se eliminarán {target.resourceCount} recursos del ambiente{' '}
        <code>{target.environmentName}</code>. La evidencia y los logs se conservarán.
      </p>
      <div className="cost-warning">
        <span>Costo acumulado</span>
        <strong>{target.accumulatedCostLabel}</strong>
      </div>
      <label>
        Escribe <strong>{target.confirmationWord}</strong> para confirmar
        <input
          placeholder={target.confirmationWord}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
        />
      </label>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="danger" disabled={!canDestroy} onClick={onConfirm}>
          Destruir {target.resourceCount} recursos
        </Button>
      </div>
    </Modal>
  )
}
