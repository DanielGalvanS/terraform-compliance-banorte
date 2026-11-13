import type { Finding, FindingsSummary } from '../model'

export const findings: Finding[] = [
  {
    id: 'FND-2841',
    severity: 'Crítica',
    title: 'SSH abierto a internet',
    resource: 'fw-allow-ssh',
    framework: 'CIS GCP',
    control: '3.6',
    origin: 'Drift',
    environment: 'Prod',
    state: 'Abierto',
    detectedAtLabel: 'Hoy, 10:34',
    violatedControl: {
      code: 'CIS GCP 3.6',
      statement: 'Asegurar que SSH no esté abierto a internet.',
      equivalents: ['CNBV C-12', 'NIST AC-4', 'ISO A.8.20'],
    },
    evidence: 'source_ranges = ["0.0.0.0/0"]\nports         = ["22"]\ndirection     = "INGRESS"',
    explanation: {
      text:
        'La regla permite intentos SSH desde cualquier IP pública. El riesgo es explotable y afecta un activo en producción. Recomiendo limitar el origen a la red corporativa.',
      confidencePercent: 98,
      engine: 'OPA + Checkov',
    },
    remediation: {
      removed: ['- source_ranges = ["0.0.0.0/0"]'],
      added: ['+ source_ranges = ["10.80.0.0/16"]', '+ description = "SSH corporativo autorizado"'],
    },
  },
  {
    id: 'FND-2838',
    severity: 'Alta',
    title: 'Cloud SQL sin clave CMEK',
    resource: 'sql-mdc-qa-01',
    framework: 'PCI DSS',
    control: '3.5',
    origin: 'Plan',
    environment: 'QA',
    state: 'En remediación',
    detectedAtLabel: 'Hoy, 10:21',
    violatedControl: {
      code: 'PCI DSS 3.5',
      statement: 'Proteger las claves de cifrado con claves administradas por el cliente.',
      equivalents: ['CNBV C-9', 'ISO A.8.24'],
    },
    evidence: 'encryption_key_name = null\ndatabase_version    = "POSTGRES_15"',
    explanation: {
      text:
        'La instancia usa cifrado administrado por Google. El control exige claves CMEK en entornos que procesan datos de tarjeta.',
      confidencePercent: 94,
      engine: 'OPA + Asset Inventory',
    },
    remediation: {
      removed: ['- encryption_key_name = null'],
      added: ['+ encryption_key_name = google_kms_crypto_key.sql.id'],
    },
  },
  {
    id: 'FND-2829',
    severity: 'Media',
    title: 'Rotación de secreto > 90 días',
    resource: 'sm-app-secrets',
    framework: 'ISO 27001',
    control: 'A.8.24',
    origin: 'Auditoría',
    environment: 'Prod',
    state: 'Abierto',
    detectedAtLabel: 'Ayer, 17:02',
    violatedControl: {
      code: 'ISO 27001 A.8.24',
      statement: 'Rotar las claves criptográficas dentro del periodo definido.',
      equivalents: ['PCI DSS 3.6', 'NIST SC-12'],
    },
    evidence: 'rotation_period = null\nnext_rotation   = "—"',
    explanation: {
      text:
        'El secreto supera el periodo de rotación de 90 días. No hay evidencia de rotación manual en el log.',
      confidencePercent: 91,
      engine: 'Secret Manager + Policy graph',
    },
    remediation: {
      removed: ['- rotation_period = null'],
      added: ['+ rotation_period = "7776000s"'],
    },
  },
  {
    id: 'FND-2820',
    severity: 'Alta',
    title: 'Permiso IAM excesivo',
    resource: 'sa-deployer-qa',
    framework: 'CNBV',
    control: 'C-7',
    origin: 'Evento',
    environment: 'QA',
    state: 'Excepción',
    detectedAtLabel: '26 Jun, 11:48',
    violatedControl: {
      code: 'CNBV C-7',
      statement: 'Aplicar el principio de mínimo privilegio a las cuentas de servicio.',
      equivalents: ['CIS GCP 1.5', 'NIST AC-6'],
    },
    evidence: 'role   = "roles/editor"\nmember = "serviceAccount:sa-deployer-qa"',
    explanation: {
      text:
        'La cuenta de servicio tiene rol editor a nivel proyecto. Existe una excepción vigente aprobada para pruebas de integración.',
      confidencePercent: 96,
      engine: 'IAM Recommender + OPA',
    },
    remediation: {
      removed: ['- role = "roles/editor"'],
      added: ['+ role = "roles/container.developer"'],
    },
  },
  {
    id: 'FND-2811',
    severity: 'Baja',
    title: 'Etiqueta de costo ausente',
    resource: 'gcs-logs-dev',
    framework: 'NIST',
    control: 'CM-8',
    origin: 'Plan',
    environment: 'Dev',
    state: 'Abierto',
    detectedAtLabel: '25 Jun, 09:15',
    violatedControl: {
      code: 'NIST CM-8',
      statement: 'Mantener un inventario completo y etiquetado de los componentes.',
      equivalents: ['CIS GCP 1.14'],
    },
    evidence: 'labels = {\n  owner = "platform"\n}',
    explanation: {
      text:
        'Falta la etiqueta de centro de costos. El impacto es de gobierno y no expone el activo.',
      confidencePercent: 89,
      engine: 'Checkov',
    },
    remediation: {
      removed: [],
      added: ['+ labels = { owner = "platform", cost_center = "cc-1042" }'],
    },
  },
]

/** Portfolio totals, which include findings outside the current page of rows. */
export const findingsSummary: FindingsSummary = {
  counts: [
    { severity: 'Crítica', count: 2 },
    { severity: 'Alta', count: 4 },
    { severity: 'Media', count: 6 },
    { severity: 'Baja', count: 3 },
  ],
  totalLabel: '15 hallazgos · 12 abiertos',
}
