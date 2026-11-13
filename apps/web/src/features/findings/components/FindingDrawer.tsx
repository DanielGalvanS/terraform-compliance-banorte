import { Badge, Button, DetailGrid, DetailSection, Drawer, Icon, TagList } from '@/shared/ui'
import { severityTone } from '@/shared/model'
import type { Finding } from '../model'

type FindingDrawerProps = {
  finding: Finding
  onClose: () => void
  /** Confirms an action taken from the drawer, e.g. "Ticket COMP-472 creado". */
  onAction: (message: string) => void
}

export function FindingDrawer({ finding, onClose, onAction }: FindingDrawerProps) {
  return (
    <Drawer
      onClose={onClose}
      header={
        <>
          <Badge tone={severityTone(finding.severity)}>{finding.severity}</Badge>
          <h2>{finding.title}</h2>
          <code>{finding.id}</code>
        </>
      }
      footer={
        <>
          <Button icon="branch" onClick={() => onAction('Abriendo PR de remediación #143…')}>
            Ver PR de remediación
          </Button>
          <Button variant="secondary" onClick={() => onAction('Ticket COMP-472 creado')}>
            Escalar a ticket
          </Button>
          <Button variant="ghost" onClick={() => onAction('Solicitud de excepción iniciada')}>
            Solicitar excepción
          </Button>
        </>
      }
    >
      <div className="drawer-body">
        <DetailGrid
          items={[
            { label: 'RECURSO AFECTADO', value: <code>{finding.resource}</code> },
            { label: 'AMBIENTE', value: <strong>{finding.environment}</strong> },
            { label: 'ORIGEN', value: <strong>{finding.origin}</strong> },
            { label: 'DETECTADO', value: <strong>{finding.detectedAtLabel}</strong> },
          ]}
        />
        <DetailSection title="Control violado">
          <div className="control-box">
            <Icon name="shield" />
            <div>
              <strong>{finding.violatedControl.code}</strong>
              <p>{finding.violatedControl.statement}</p>
              <TagList
                tags={finding.violatedControl.equivalents.map((text) => ({ text }))}
              />
            </div>
          </div>
        </DetailSection>
        <DetailSection title="Evidencia">
          <pre>{finding.evidence}</pre>
        </DetailSection>
        <div className="agent-explain">
          <span>
            <Icon name="agent" />
          </span>
          <div>
            <small>EXPLICACIÓN DEL AGENTE</small>
            <p>{finding.explanation.text}</p>
            <strong>
              Confianza: {finding.explanation.confidencePercent}% · {finding.explanation.engine}
            </strong>
          </div>
        </div>
        <DetailSection title="Remediación propuesta">
          <div className="diff">
            {finding.remediation.removed.map((line) => (
              <code className="remove" key={line}>
                {line}
              </code>
            ))}
            {finding.remediation.added.map((line) => (
              <code className="add" key={line}>
                {line}
              </code>
            ))}
          </div>
        </DetailSection>
      </div>
    </Drawer>
  )
}
