import type { Finding, FindingsSummary } from '../model'

export const findings: Finding[] = [
  {
    id: 'FND-2841',
    severity: 'Crítica',
    title: 'SSH abierto a internet',
    resource: 'fw-allow-ssh',
    catalogControl: 'CO-NET-01',
    framework: 'CIS GCP',
    control: '3.6',
    origin: 'Drift',
    environment: 'Prod',
    state: 'Abierto',
    detectedAtLabel: 'Hoy, 10:34',
    violatedControl: {
      code: 'CIS GCP 3.6',
      statement: 'Asegurar que SSH no esté abierto a internet.',
      equivalents: ['NIST SC-7', 'NIST AC-4', 'SOC 2 CC6.6'],
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
    catalogControl: 'CO-DB-02',
    framework: 'NIST 800-53',
    control: 'SC-28',
    origin: 'Plan',
    environment: 'QA',
    state: 'En remediación',
    detectedAtLabel: 'Hoy, 10:21',
    violatedControl: {
      code: 'NIST 800-53 SC-28',
      statement: 'Proteger la información en reposo con llaves bajo custodia de la organización.',
      equivalents: ['CIS GCP 6.x', 'LFPDPPP · principio de seguridad', 'SOC 2 CC6.1'],
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
    framework: 'NIST 800-53',
    control: 'SC-12',
    origin: 'Auditoría',
    environment: 'Prod',
    state: 'Abierto',
    detectedAtLabel: 'Ayer, 17:02',
    violatedControl: {
      code: 'NIST 800-53 SC-12',
      statement: 'Rotar las llaves criptográficas dentro del periodo definido.',
      equivalents: ['LFPDPPP · principio de seguridad', 'SOC 2 CC6.1'],
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
    catalogControl: 'CO-IAM-01',
    framework: 'NIST 800-53',
    control: 'AC-6',
    origin: 'Evento',
    environment: 'QA',
    state: 'Excepción',
    detectedAtLabel: '26 Jun, 11:48',
    violatedControl: {
      code: 'NIST 800-53 AC-6',
      statement: 'Aplicar el principio de mínimo privilegio a las cuentas de servicio.',
      equivalents: ['CIS GCP 1.x', 'SOC 2 CC6.3'],
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
    catalogControl: 'CO-TAG-01',
    framework: 'NIST 800-53',
    control: 'CM-8',
    origin: 'Plan',
    environment: 'Dev',
    state: 'Abierto',
    detectedAtLabel: '25 Jun, 09:15',
    violatedControl: {
      code: 'NIST 800-53 CM-8',
      statement: 'Mantener un inventario completo y etiquetado de los componentes.',
      equivalents: ['LFPDPPP · principio de responsabilidad', 'SOC 2 CC6.1'],
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
