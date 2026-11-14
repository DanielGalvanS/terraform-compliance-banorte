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
  },
]
