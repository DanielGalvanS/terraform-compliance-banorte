import type {
  AgentActivity,
  CostSummary,
  FindingsTrend,
  FrameworkScore,
  Kpi,
  PostureSummary,
} from '../model'

export const posture: PostureSummary = {
  headline: 'Todos los sistemas operativos',
  lastAssessment: 'Última evaluación global: hoy, 10:42',
  badge: 'Prod conforme',
}

export const kpis: Kpi[] = [
  {
    id: 'pre-apply',
    label: 'Validación pre-apply',
    icon: 'shield',
    value: '100%',
    featured: true,
    footnote: [
      { text: '+2,1%', emphasis: true },
      { text: ' vs. periodo anterior' },
    ],
  },
  {
    id: 'open-findings',
    label: 'Hallazgos abiertos',
    icon: 'findings',
    value: '12',
    severityBreakdown: { critical: 2, high: 4, medium: 6 },
  },
  {
    id: 'drift-detection',
    label: 'Detección media de drift',
    icon: 'clock',
    value: '42',
    unit: 'min',
    footnote: [{ text: '−8 min', emphasis: true }, { text: ' este mes' }],
  },
  {
    id: 'critical-remediation',
    label: 'Remediación de críticos',
    icon: 'performance',
    value: '6',
    unit: 'h',
    footnote: [{ text: 'Objetivo: ' }, { text: '< 8 h', emphasis: true }],
  },
  {
    id: 'false-positives',
    label: 'Falsos positivos IA',
    icon: 'agent',
    value: '7%',
    footnote: [{ text: '−1,4%', emphasis: true }, { text: ' este mes' }],
  },
  {
    id: 'unmanaged',
    label: 'Fuera de Terraform',
    icon: 'inventory',
    value: '0',
    footnote: [{ text: '184 recursos gestionados' }],
  },
]

export const frameworkScores: FrameworkScore[] = [
  { framework: 'CIS GCP', score: 88 },
  { framework: 'LFPDPPP', score: 98 },
  { framework: 'NIST 800-53', score: 93 },
  { framework: 'SOC 2', score: 95 },
]

export const findingsTrend: FindingsTrend = {
  points: [18, 16, 19, 15, 14, 16, 13, 12, 14, 11, 10, 12, 9, 8],
  labels: { 0: '1 Jun', 7: '15 Jun', 13: 'Hoy' },
  openToday: 12,
  changeLabel: '−33%',
}

export const agentActivity: AgentActivity[] = [
  {
    id: 'drift-fw-allow-ssh',
    icon: 'findings',
    tone: 'critical',
    text: 'Detectó drift en firewall fw-allow-ssh',
    meta: 'CIS GCP 3.6 · hace 8 min',
  },
  {
    id: 'pr-142',
    icon: 'branch',
    tone: 'info',
    text: 'Propuso PR #142 para cifrado CMEK',
    meta: 'cloud-sql · hace 21 min',
  },
  {
    id: 'pr-139-verified',
    icon: 'check',
    tone: 'success',
    text: 'Verificó despliegue PR #139',
    meta: '12 controles conformes · hace 46 min',
  },
  {
    id: 'approval-requested',
    icon: 'shield',
    tone: 'warning',
    text: 'Solicitó aprobación humana',
    meta: 'Producción · hace 1 h',
  },
]

export const costSummary: CostSummary = {
  scope: 'Ambiente Prod · Junio',
  spentLabel: 'MXN 186,420',
  budgetLabel: 'de MXN 220,000',
  usedPercent: 84.7,
  projectionLabel: 'Proyección al cierre: MXN 227,800',
}
