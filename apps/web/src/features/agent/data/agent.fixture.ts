import type {
  AgentDecision,
  AgentStatus,
  AutonomyRule,
  CycleStep,
  Permission,
} from '../model'

export const status: AgentStatus = { version: 'v2.4.1', label: 'Operativo' }

export const cycleSteps: CycleStep[] = [
  { name: 'Disparador', owner: 'deterministic' },
  { name: 'Sensar', owner: 'deterministic' },
  { name: 'Evaluar', owner: 'ai' },
  { name: '¿Cumple?', owner: 'deterministic' },
  { name: 'Clasificar', owner: 'ai' },
  { name: '¿Remediable?', owner: 'ai' },
  { name: 'Proponer PR / Escalar', owner: 'ai' },
  { name: 'Aprobación', owner: 'human' },
  { name: 'Aplicar y verificar', owner: 'deterministic' },
]

export const decisions: AgentDecision[] = [
  {
    id: 'dec-1034',
    timeLabel: '10:34',
    title: 'Bloqueó despliegue por SSH público',
    tools: 'OPA · Checkov · Terraform plan',
    rationale:
      'La exposición es explotable y afecta producción; no existe excepción vigente.',
    outcomeLabel: 'Escalado',
    outcomeTone: 'critical',
  },
  {
    id: 'dec-1021',
    timeLabel: '10:21',
    title: 'Propuso cifrado CMEK en Cloud SQL',
    tools: 'Asset Inventory · Gemini',
    rationale: 'Se evaluaron contexto, criticidad del activo y controles aplicables.',
    outcomeLabel: 'PR #142',
    outcomeTone: 'info',
  },
  {
    id: 'dec-0948',
    timeLabel: '09:48',
    title: 'Validó ausencia de drift',
    tools: 'Cloud Audit Logs · Terraform',
    rationale: 'Se evaluaron contexto, criticidad del activo y controles aplicables.',
    outcomeLabel: 'Conforme',
    outcomeTone: 'success',
  },
  {
    id: 'dec-0815',
    timeLabel: '08:15',
    title: 'Priorizó rotación de secreto',
    tools: 'Secret Manager · Policy graph',
    rationale: 'Se evaluaron contexto, criticidad del activo y controles aplicables.',
    outcomeLabel: 'Alta',
    outcomeTone: 'warning',
  },
]

export const autonomyRules: AutonomyRule[] = [
  {
    environment: 'Dev',
    tone: 'info',
    lowAndMedium: 'PR + auto-merge',
    highAndCritical: 'PR + aprobación',
  },
  {
    environment: 'QA',
    tone: 'warning',
    lowAndMedium: 'PR + auto-merge',
    highAndCritical: 'PR + aprobación',
  },
  {
    environment: 'Prod',
    tone: 'critical',
    lowAndMedium: 'Aprobación',
    highAndCritical: 'Doble aprobación',
  },
]

export const permissions: Permission[] = [
  { text: 'Solo lectura en recursos GCP', granted: true },
  { text: 'Crear pull requests, sin merge', granted: true },
  { text: 'Escribir evidencia append-only', granted: true },
  { text: 'Sin acceso directo a producción', granted: false },
  { text: 'Sin capacidad de omitir políticas', granted: false },
]
