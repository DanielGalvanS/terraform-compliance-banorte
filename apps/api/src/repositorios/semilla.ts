import { randomUUID } from 'node:crypto'
import type { Hallazgo } from '../model/esquemas.ts'

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
