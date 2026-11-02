import type { DestroyTarget, TestRun, TestRunConfig } from '../model'

export const runConfig: TestRunConfig = {
  environments: ['QA · mdc-qa', 'Dev · mdc-dev'],
  durations: ['15 minutos', '30 minutos', '1 hora'],
  tests: [
    { id: 'latency', label: 'Latencia de red' },
    { id: 'throughput', label: 'Throughput' },
    { id: 'iops', label: 'IOPS de almacenamiento' },
    { id: 'sql', label: 'Respuesta de Cloud SQL' },
    { id: 'deploy', label: 'Tiempo total de despliegue' },
  ],
  estimatedCostLabel: 'Costo estimado: MXN 184 · Sin impacto en Prod',
}

export const latestRun: TestRun = {
  id: 'RUN-059',
  contextLabel: 'Hoy, 09:12 · QA · 15 min',
  metrics: [
    { name: 'Latencia red', value: '18 ms', targetLabel: '≤ 25 ms', achievedPercent: 72 },
    { name: 'Throughput', value: '8.4 Gbps', targetLabel: '≥ 7 Gbps', achievedPercent: 91 },
    { name: 'IOPS Storage', value: '14,280', targetLabel: '≥ 12k', achievedPercent: 86 },
    { name: 'Cloud SQL', value: '32 ms', targetLabel: '≤ 50 ms', achievedPercent: 78 },
    { name: 'Despliegue', value: '8m 14s', targetLabel: '≤ 10 min', achievedPercent: 82 },
  ],
  comparisons: [
    { name: 'Latencia', currentPercent: 62, previousPercent: 74 },
    { name: 'Throughput', currentPercent: 88, previousPercent: 80 },
    { name: 'IOPS', currentPercent: 82, previousPercent: 75 },
    { name: 'Cloud SQL', currentPercent: 77, previousPercent: 69 },
  ],
}

export const destroyTarget: DestroyTarget = {
  environmentName: 'mdc-qa',
  resourceCount: 46,
  accumulatedCostLabel: 'MXN 12,840.62',
  confirmationWord: 'DESTRUIR',
}
