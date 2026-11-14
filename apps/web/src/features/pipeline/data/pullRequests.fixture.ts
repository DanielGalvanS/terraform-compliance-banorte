import type { PipelineStep, PullRequest } from '../model'

/** Steps that have not started yet share the same waiting log. */
function waiting(name: string, reason: string): PipelineStep {
  return { name, status: 'pending', duration: '—', log: `WAIT  ${name.toLowerCase()}\n${reason}` }
}

const BLOCKED_REASON =
  'Este paso permanece en espera hasta resolver el bloqueo de políticas.\nNo se ejecutará ninguna acción en producción sin aprobación humana.'

const APPROVAL_REASON =
  'Este paso espera la decisión del aprobador asignado.\nNinguna acción se ejecuta sin aprobación humana.'

export const pullRequests: PullRequest[] = [
  {
    id: 142,
    title: 'feat(sql): habilitar alta disponibilidad regional',
    description:
      'Actualiza el módulo Cloud SQL a v6.1 y habilita réplica regional para sql-mdc-prod-01.',
    environment: 'Prod',
    stateLabel: 'Bloqueado',
    tone: 'critical',
    author: 'Lucía M.',
    age: 'hace 18 min',
    commit: '9f2a7c1',
    run: {
      id: 'Ejecución #890',
      startedLabel: 'Iniciada hace 18 min por Lucía Méndez',
      stateLabel: 'Despliegue bloqueado',
      stateTone: 'critical',
      steps: [
        { name: 'terraform fmt', status: 'ok', duration: '4 s', log: 'PASS  terraform fmt\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'validate', status: 'ok', duration: '12 s', log: 'PASS  validate\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'Checkov', status: 'warning', duration: '38 s', log: 'PASS  checkov\nCompleted with 2 warnings.\nArtifact signed and attached to evidence log.' },
        { name: 'plan (JSON)', status: 'ok', duration: '1 m 42 s', log: 'PASS  plan (json)\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'Políticas', status: 'blocked', duration: '21 s', log: 'FAIL  policy/gcp/networking.rego\n→ CIS GCP 3.6: SSH ingress must not allow 0.0.0.0/0\nresource: google_compute_firewall.allow_ssh\nline 47 · main.tf' },
        { name: 'Decisión IA', status: 'blocked', duration: '8 s', log: 'HALT  decisión ia\nEl veredicto determinista bloquea el cambio; el agente no propone excepciones.' },
        waiting('Aprobación', BLOCKED_REASON),
        waiting('apply', BLOCKED_REASON),
        waiting('Post-check', BLOCKED_REASON),
      ],
    },
    verdict: {
      title: 'Bloqueado por política',
      summary: 'El plan expone SSH (puerto 22) a internet mediante 0.0.0.0/0.',
      violatedControls: ['CO-NET-01', 'CIS GCP 3.6'],
      recommendation: 'Limitar el origen al rango corporativo 10.80.0.0/16.',
      confidencePercent: 98,
      engine: 'Política OPA',
    },
  },
  {
    id: 141,
    title: 'fix(network): restringir acceso SSH',
    description:
      'Reemplaza el origen 0.0.0.0/0 por el rango corporativo en la regla de firewall de QA.',
    environment: 'QA',
    stateLabel: 'En aprobación',
    tone: 'warning',
    author: 'Diego R.',
    age: 'hace 1 h',
    commit: 'c41b8de',
    run: {
      id: 'Ejecución #889',
      startedLabel: 'Iniciada hace 1 h por Diego Ramírez',
      stateLabel: 'Esperando aprobación',
      stateTone: 'warning',
      steps: [
        { name: 'terraform fmt', status: 'ok', duration: '3 s', log: 'PASS  terraform fmt\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'validate', status: 'ok', duration: '11 s', log: 'PASS  validate\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'Checkov', status: 'ok', duration: '31 s', log: 'PASS  checkov\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'plan (JSON)', status: 'ok', duration: '1 m 18 s', log: 'PASS  plan (json)\n1 to change, 0 to destroy.\nArtifact signed and attached to evidence log.' },
        { name: 'Políticas', status: 'ok', duration: '19 s', log: 'PASS  policy/gcp/networking.rego\n12 controles evaluados, 0 violaciones.' },
        { name: 'Decisión IA', status: 'ok', duration: '7 s', log: 'PASS  decisión ia\nRiesgo bajo: el cambio reduce exposición pública. Confianza 96%.' },
        waiting('Aprobación', APPROVAL_REASON),
        waiting('apply', APPROVAL_REASON),
        waiting('Post-check', APPROVAL_REASON),
      ],
    },
  },
  {
    id: 140,
    title: 'chore(storage): actualizar módulo a v4.2',
    description: 'Actualiza el módulo de Cloud Storage y ajusta la política de ciclo de vida.',
    environment: 'Dev',
    stateLabel: 'Validando',
    tone: 'info',
    author: 'CI Bot',
    age: 'hace 2 h',
    commit: '7de02af',
    run: {
      id: 'Ejecución #888',
      startedLabel: 'Iniciada hace 2 h por CI Bot',
      stateLabel: 'Validación en curso',
      stateTone: 'info',
      steps: [
        { name: 'terraform fmt', status: 'ok', duration: '4 s', log: 'PASS  terraform fmt\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'validate', status: 'ok', duration: '10 s', log: 'PASS  validate\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'Checkov', status: 'warning', duration: '29 s', log: 'PASS  checkov\nCompleted with 1 warning.\nArtifact signed and attached to evidence log.' },
        waiting('plan (JSON)', 'El plan se genera al finalizar el análisis estático.'),
        waiting('Políticas', 'Las políticas se evalúan sobre el plan en formato JSON.'),
        waiting('Decisión IA', 'El agente interviene después de la evaluación determinista.'),
        waiting('Aprobación', 'Dev con severidad baja: se auto-aprueba al pasar las políticas.'),
        waiting('apply', 'Pendiente de la validación anterior.'),
        waiting('Post-check', 'Pendiente de la validación anterior.'),
      ],
    },
  },
  {
    id: 139,
    title: 'feat(nat): agregar gateway secundario',
    description: 'Agrega un segundo Cloud NAT para la subred de datos en us-central1.',
    environment: 'Prod',
    stateLabel: 'Aplicado',
    tone: 'success',
    author: 'Ana S.',
    age: 'ayer',
    commit: '4b19f70',
    run: {
      id: 'Ejecución #884',
      startedLabel: 'Iniciada ayer 09:12 por Ana Silva',
      stateLabel: 'Aplicado y verificado',
      stateTone: 'success',
      steps: [
        { name: 'terraform fmt', status: 'ok', duration: '4 s', log: 'PASS  terraform fmt\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'validate', status: 'ok', duration: '12 s', log: 'PASS  validate\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'Checkov', status: 'ok', duration: '35 s', log: 'PASS  checkov\nCompleted with no errors.\nArtifact signed and attached to evidence log.' },
        { name: 'plan (JSON)', status: 'ok', duration: '1 m 29 s', log: 'PASS  plan (json)\n2 to add, 0 to destroy.\nArtifact signed and attached to evidence log.' },
        { name: 'Políticas', status: 'ok', duration: '18 s', log: 'PASS  policy/gcp/networking.rego\n12 controles evaluados, 0 violaciones.' },
        { name: 'Decisión IA', status: 'ok', duration: '6 s', log: 'PASS  decisión ia\nCambio aditivo sin exposición pública. Confianza 97%.' },
        { name: 'Aprobación', status: 'ok', duration: '24 m', log: 'PASS  aprobación\nAprobada por Mariana Torres con comentario y firma digital.' },
        { name: 'apply', status: 'ok', duration: '3 m 08 s', log: 'PASS  apply\n2 added, 0 changed, 0 destroyed.\nArtifact signed and attached to evidence log.' },
        { name: 'Post-check', status: 'ok', duration: '41 s', log: 'PASS  post-check\n12 controles conformes. Evidencia EV-2025-0628-888 registrada.' },
      ],
    },
  },
]
