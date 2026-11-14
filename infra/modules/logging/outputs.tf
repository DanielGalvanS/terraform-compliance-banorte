output "bucket" {
  description = "Nombre del bucket de evidencia."
  value       = google_storage_bucket.evidencia.name
}

output "retencion_bloqueada" {
  description = "Si la retención quedó bloqueada de forma irreversible."
  value       = var.bloquear_retencion
}

output "identidad_del_sink" {
  description = "Identidad con la que el sink escribe, para la evidencia de auditoría."
  value       = google_logging_project_sink.evidencia.writer_identity
}
