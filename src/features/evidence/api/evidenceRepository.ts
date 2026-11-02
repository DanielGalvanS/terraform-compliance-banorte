import {
  coverage,
  evidenceLog,
  exportFormats,
  reportOptions,
} from '../data/evidence.fixture'
import type { EvidenceCoverage, EvidenceEntry, ExportFormat, ReportOptions } from '../model'

export const evidenceRepository = {
  getEvidenceLog: (): EvidenceEntry[] => evidenceLog,
  getCoverage: (): EvidenceCoverage => coverage,
  getReportOptions: (): ReportOptions => reportOptions,
  getExportFormats: (): ExportFormat[] => exportFormats,
}
