import { useState } from 'react'
import { Button, Icon, Modal } from '@/shared/ui'
import type { ExportFormat } from '../model'

type AuditExportModalProps = {
  formats: ExportFormat[]
  onClose: () => void
  onExport: (formatId: string) => void
}

export function AuditExportModal({ formats, onClose, onExport }: AuditExportModalProps) {
  const [selected, setSelected] = useState(formats[0]?.id ?? '')

  return (
    <Modal className="export-modal" onClose={onClose} showCloseButton>
      <div className="modal-brand">
        <Icon name="shield" size={26} />
      </div>
      <h2>Exportar paquete de auditoría</h2>
      <p>
        Incluye reporte ejecutivo, detalle de controles, evidencias y cadena de integridad.
      </p>
      <div className="export-options">
        {formats.map((format) => (
          <label key={format.id}>
            <input
              type="radio"
              name="format"
              checked={selected === format.id}
              onChange={() => setSelected(format.id)}
            />
            <span>
              <strong>{format.title}</strong>
              <small>{format.description}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button icon="download" onClick={() => onExport(selected)}>
          Generar exportación
        </Button>
      </div>
    </Modal>
  )
}
