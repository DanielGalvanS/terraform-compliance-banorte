import { useState, type FormEvent } from 'react'
import { Badge, Button, HumanOversightBanner } from '@/shared/ui'
import { ENVIRONMENTS, severityTone, type Environment } from '@/shared/model'
import { exceptionsRepository } from '../api/exceptionsRepository'
import { addDays, MAX_VALIDITY_DAYS, today, toIsoDate } from '../model/expiry'
import { MIN_JUSTIFICATION_LENGTH, validateNewException } from '../model/validation'
import type { ValidationErrors } from '../model/validation'
import type { NewExceptionInput } from '../model'

type NewExceptionFormProps = {
  /** Environment selected in the top bar, used as the default. */
  defaultEnvironment: Environment
  onCancel: () => void
  /**
   * Devuelve los errores que la API rechazó, por campo, o nada si aceptó.
   * La validación local evita viajes inútiles; la de la API es la que manda.
   */
  onSubmit: (input: NewExceptionInput) => Promise<ValidationErrors | void>
}

function emptyForm(environment: Environment): NewExceptionInput {
  return {
    control: '',
    resource: '',
    environment,
    justification: '',
    expiresOn: '',
    approver: '',
    remediationPlan: '',
  }
}

export function NewExceptionForm({
  defaultEnvironment,
  onCancel,
  onSubmit,
}: NewExceptionFormProps) {
  const [form, setForm] = useState<NewExceptionInput>(() => emptyForm(defaultEnvironment))
  const [errors, setErrors] = useState<ValidationErrors>({})

  const minDate = toIsoDate(today())
  const maxDate = toIsoDate(addDays(today(), MAX_VALIDITY_DAYS))
  const selectedControl = exceptionsRepository.findControl(form.control)

  const update = (key: keyof NewExceptionInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateNewException(form, { minDate, maxDate })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setEnviando(true)
    try {
      const rechazo = await onSubmit(form)
      if (rechazo) setErrors(rechazo)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="drawer-body exception-form" onSubmit={handleSubmit}>
      <HumanOversightBanner
        icon="shield"
        title="Aprobación humana obligatoria"
        description="Las excepciones en producción requieren aprobación humana y nunca se activan de forma automática."
      />
      <label>
        Hallazgo o control *
        <select value={form.control} onChange={(event) => update('control', event.target.value)}>
          <option value="">Buscar control…</option>
          {exceptionsRepository.getControlCatalog().map((control) => (
            <option key={control.code} value={control.code}>
              {control.code} · {control.name}
            </option>
          ))}
        </select>
        {errors.control && <small className="field-error">{errors.control}</small>}
      </label>
      {selectedControl && (
        <div className="readonly-fields">
          <span>
            <small>MARCO</small>
            <strong>{selectedControl.framework}</strong>
          </span>
          <span>
            <small>SEVERIDAD</small>
            <Badge tone={severityTone(selectedControl.severity)}>{selectedControl.severity}</Badge>
          </span>
        </div>
      )}
      <label>
        Recurso afectado *
        <select value={form.resource} onChange={(event) => update('resource', event.target.value)}>
          <option value="">Buscar recurso…</option>
          {exceptionsRepository.getResourceCatalog().map((resource) => (
            <option key={resource}>{resource}</option>
          ))}
        </select>
        {errors.resource && <small className="field-error">{errors.resource}</small>}
      </label>
      <label>
        Ambiente *
        <select
          value={form.environment}
          onChange={(event) => update('environment', event.target.value)}
        >
          {ENVIRONMENTS.map((environment) => (
            <option key={environment}>{environment}</option>
          ))}
        </select>
      </label>
      <label>
        Justificación *
        <textarea
          value={form.justification}
          onChange={(event) => update('justification', event.target.value)}
          placeholder="Explica el motivo, alcance y riesgo aceptado…"
        />
        <span className="field-meta">
          <small className="field-error">{errors.justification}</small>
          <small>
            {form.justification.length}/{MIN_JUSTIFICATION_LENGTH} mín.
          </small>
        </span>
      </label>
      <label>
        Vigencia hasta *
        <input
          type="date"
          min={minDate}
          max={maxDate}
          value={form.expiresOn}
          onChange={(event) => update('expiresOn', event.target.value)}
        />
        <span className="field-meta">
          <small className="field-error">{errors.expiresOn}</small>
          <small>Máximo: {maxDate}</small>
        </span>
      </label>
      <label>
        Aprobador *
        <select value={form.approver} onChange={(event) => update('approver', event.target.value)}>
          <option value="">Seleccionar usuario con rol Aprobador…</option>
          {exceptionsRepository.getApprovers().map((approver) => (
            <option key={approver}>{approver}</option>
          ))}
        </select>
        {errors.approver && <small className="field-error">{errors.approver}</small>}
      </label>
      <label>
        Plan de remediación <small>(opcional)</small>
        <input
          value={form.remediationPlan}
          onChange={(event) => update('remediationPlan', event.target.value)}
          placeholder="Descripción o enlace a Jira"
        />
      </label>
      <div className="drawer-actions form-actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon="arrow" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar para aprobación'}
        </Button>
      </div>
    </form>
  )
}
