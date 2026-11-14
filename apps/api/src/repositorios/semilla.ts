import { randomUUID } from 'node:crypto'
import type { Hallazgo } from '../model/esquemas.ts'
import type { RecursoGuardado } from '../model/recursos.ts'
import type { ExcepcionGuardada } from './excepcionesRepositorio.ts'

/**
 * Hallazgos de ejemplo, para que la API responda algo mientras no hay base.
 * Son los mismos casos que muestra el prototipo, y cada uno cita un control
 * que existe en el catálogo.
 */
export const hallazgosDeEjemplo: Hallazgo[] = [
  {
    id: randomUUID(),
    control: 'CO-NET-01',
    titulo: 'SSH abierto a internet',
    recurso: 'google_compute_firewall.allow_ssh',
    severidad: 'Crítica',
    ambiente: 'Prod',
    origen: 'Drift',
    estado: 'Abierto',
    mensaje: 'La regla expone el puerto 22 a 0.0.0.0/0.',
    detectadoEn: new Date().toISOString(),
    detalle: {
      controlViolado: {
        codigo: 'CIS GCP 3.6',
        enunciado: 'Asegurar que SSH no esté abierto a internet.',
        equivalentes: ['NIST SC-7', 'NIST AC-4', 'SOC 2 CC6.6'],
      },
      evidencia: 'source_ranges = ["0.0.0.0/0"]\nports         = ["22"]\ndirection     = "INGRESS"',
      explicacion: {
        texto:
          'La regla permite intentos SSH desde cualquier IP pública. El riesgo es ' +
          'explotable y afecta un activo en producción.',
        confianza: 98,
        motor: 'OPA + Checkov',
      },
      remediacion: {
        quitadas: ['- source_ranges = ["0.0.0.0/0"]'],
        anadidas: ['+ source_ranges = ["10.80.0.0/16"]'],
      },
    },
  },
  {
    id: randomUUID(),
    control: 'CO-DB-02',
    titulo: 'Cloud SQL sin clave CMEK',
    recurso: 'google_sql_database_instance.main',
    severidad: 'Alta',
    ambiente: 'QA',
    origen: 'Plan',
    estado: 'En remediación',
    mensaje: 'La instancia no declara encryption_key_name.',
    detectadoEn: new Date().toISOString(),
    detalle: {
      controlViolado: {
        codigo: 'NIST 800-53 SC-28',
        enunciado: 'Proteger la información en reposo con llaves bajo custodia de la organización.',
        equivalentes: ['CIS GCP 6.x', 'LFPDPPP · principio de seguridad', 'SOC 2 CC6.1'],
      },
      evidencia: 'encryption_key_name = null\ndatabase_version    = "POSTGRES_15"',
      explicacion: {
        texto:
          'La instancia usa cifrado administrado por Google. El control exige llaves ' +
          'CMEK bajo custodia de la organización.',
        confianza: 94,
        motor: 'OPA + Asset Inventory',
      },
      remediacion: {
        quitadas: ['- encryption_key_name = null'],
        anadidas: ['+ encryption_key_name = google_kms_crypto_key.sql.id'],
      },
    },
  },
  {
    id: randomUUID(),
    control: 'CO-TAG-01',
    titulo: 'Etiqueta de centro de costos ausente',
    recurso: 'google_storage_bucket.logs',
    severidad: 'Media',
    ambiente: 'Dev',
    origen: 'Plan',
    estado: 'Abierto',
    mensaje: 'Falta la etiqueta obligatoria centro_costos.',
    detectadoEn: new Date().toISOString(),
    detalle: {
      controlViolado: {
        codigo: 'NIST 800-53 CM-8',
        enunciado: 'Mantener un inventario completo y etiquetado de los componentes.',
        equivalentes: ['LFPDPPP · principio de responsabilidad', 'SOC 2 CC6.1'],
      },
      evidencia: 'labels = {\n  duenio = "plataforma"\n}',
      explicacion: {
        texto:
          'Falta la etiqueta de centro de costos. El impacto es de gobierno y no ' +
          'expone el activo.',
        confianza: 89,
        motor: 'Conftest',
      },
      remediacion: {
        quitadas: [],
        anadidas: ['+ centro_costos = "cc-1042"'],
      },
    },
  },
]

/** Fecha a N días de hoy, para que la semilla no caduque sola. */
function enDias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
}

export const excepcionesDeEjemplo: ExcepcionGuardada[] = [
  {
    id: randomUUID(),
    codigo: 'EXC-1048',
    control: 'CO-NET-01',
    recurso: 'google_compute_firewall.allow_ssh',
    ambiente: 'Prod',
    justificacion: 'Acceso temporal para la migración del clúster legado.',
    solicitadaPor: 'Ana Martínez',
    aprobadaPor: 'Roberto Silva',
    solicitadaEn: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    venceEl: enDias(4),
    estadoGuardado: 'Activa',
    planRemediacion: 'OPS-2841 · Restringir reglas de firewall',
  },
  {
    id: randomUUID(),
    codigo: 'EXC-1044',
    control: 'CO-DB-02',
    recurso: 'google_sql_database_instance.main',
    ambiente: 'QA',
    justificacion: 'Dependencia del proveedor pendiente de actualización.',
    solicitadaPor: 'Carlos Vega',
    aprobadaPor: null,
    solicitadaEn: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    venceEl: enDias(42),
    estadoGuardado: 'Pendiente',
    planRemediacion: 'OPS-2860 · Migrar a CMEK',
  },
  {
    // Guardada como Activa pero con la fecha pasada: al leerla debe salir
    // Vencida, que es lo que demuestra que el estado se deriva.
    id: randomUUID(),
    codigo: 'EXC-1031',
    control: 'CO-TAG-01',
    recurso: 'google_secret_manager_secret.api_key',
    ambiente: 'Prod',
    justificacion: 'Etiquetado pendiente hasta la ventana de mantenimiento.',
    solicitadaPor: 'Ana Martínez',
    aprobadaPor: 'Roberto Silva',
    solicitadaEn: new Date(Date.now() - 45 * 86_400_000).toISOString(),
    venceEl: enDias(-6),
    estadoGuardado: 'Activa',
    planRemediacion: null,
  },
]

/** Etiquetas completas de un ambiente, para no repetirlas en cada recurso. */
function etiquetas(ambiente: string, clasificacion = 'interno'): Record<string, string> {
  return {
    duenio: 'plataforma',
    ambiente: ambiente.toLowerCase(),
    clasificacion_datos: clasificacion,
    centro_costos: 'cc-1042',
    marco_aplicable: ambiente === 'Prod' ? 'lfpdppp' : 'cis-gcp',
  }
}

export const recursosDeEjemplo: RecursoGuardado[] = [
  {
    direccion: 'module.red.google_compute_network.esta',
    nombre: 'vpc-mdc-prod',
    tipo: 'google_compute_network',
    modulo: 'network',
    version: 'v5.3.0',
    ambiente: 'Prod',
    etiquetas: {},
  },
  {
    direccion: 'module.red.google_compute_subnetwork.privada',
    nombre: 'subnet-data-prod',
    tipo: 'google_compute_subnetwork',
    modulo: 'network',
    version: 'v5.3.0',
    ambiente: 'Prod',
    etiquetas: {},
  },
  {
    direccion: 'google_compute_firewall.allow_ssh',
    nombre: 'fw-allow-ssh',
    tipo: 'google_compute_firewall',
    modulo: 'firewall',
    version: 'v3.8.2',
    ambiente: 'Prod',
    etiquetas: {},
  },
  {
    direccion: 'google_sql_database_instance.main',
    nombre: 'sql-mdc-qa-01',
    tipo: 'google_sql_database_instance',
    modulo: 'sql',
    version: 'v6.0.1',
    ambiente: 'QA',
    etiquetas: etiquetas('QA', 'confidencial'),
  },
  {
    direccion: 'google_storage_bucket.evidencia',
    nombre: 'gcs-audit-evidence',
    tipo: 'google_storage_bucket',
    modulo: 'logging',
    version: 'v4.2.0',
    ambiente: 'Prod',
    etiquetas: etiquetas('Prod', 'confidencial'),
  },
  {
    direccion: 'google_storage_bucket.logs',
    nombre: 'gcs-logs-dev',
    tipo: 'google_storage_bucket',
    modulo: 'logging',
    version: 'v4.2.0',
    ambiente: 'Dev',
    etiquetas: etiquetas('Dev'),
  },
  {
    // Le falta el centro de costos: debe salir como «Sin etiqueta».
    direccion: 'google_secret_manager_secret.api_key',
    nombre: 'sm-app-secrets',
    tipo: 'google_secret_manager_secret',
    modulo: 'secrets',
    version: 'v1.7.4',
    ambiente: 'Prod',
    etiquetas: (() => {
      const { centro_costos: _omitido, ...resto } = etiquetas('Prod', 'confidencial')
      return resto
    })(),
  },
  {
    direccion: 'module.kms.google_kms_crypto_key.estas["sql"]',
    nombre: 'kms-sql-prod',
    tipo: 'google_kms_crypto_key',
    modulo: 'kms',
    version: 'v2.1.0',
    ambiente: 'Prod',
    etiquetas: etiquetas('Prod', 'confidencial'),
  },
]
