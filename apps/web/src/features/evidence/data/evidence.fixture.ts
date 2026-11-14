import { FRAMEWORKS_IN_SCOPE } from '@/shared/model'
import type { EvidenceCoverage, EvidenceEntry, ExportFormat, ReportOptions } from '../model'

export const evidenceLog: EvidenceEntry[] = [
  {
    id: 'EV-2025-0628-890',
    description: 'Evaluación pre-apply PR #142',
    dateLabel: '28 Jun, 10:34',
    hash: 'sha256:8ac41…f29e',
    source: 'OPA / Checkov',
  },
  {
    id: 'EV-2025-0628-889',
    description: 'Snapshot de inventario GCP',
    dateLabel: '28 Jun, 10:30',
    hash: 'sha256:2bd87…91ca',
    source: 'Asset Inventory',
  },
  {
    id: 'EV-2025-0628-888',
    description: 'Verificación post-apply PR #139',
    dateLabel: '28 Jun, 09:48',
    hash: 'sha256:f903e…a172',
    source: 'Terraform',
  },
  {
    id: 'EV-2025-0627-887',
    description: 'Aprobación humana APR-876',
    dateLabel: '27 Jun, 17:12',
    hash: 'sha256:71ca4…0bd2',
    source: 'Compliance Ops',
  },
]

export const coverage: EvidenceCoverage = {
  periodLabel: 'Junio 2025',
  completed: 1420,
  pending: 18,
  invalid: 0,
}

export const reportOptions: ReportOptions = {
  frameworks: [...FRAMEWORKS_IN_SCOPE],
  environments: ['Producción', 'QA', 'Todos'],
  periods: ['Junio 2025', 'Q2 2025', 'Últimos 12 meses'],
}

export const exportFormats: ExportFormat[] = [
  { id: 'pdf', title: 'PDF firmado', description: 'Reporte completo para auditor' },
  { id: 'data', title: 'CSV + JSON', description: 'Datos estructurados y evidencias' },
]
