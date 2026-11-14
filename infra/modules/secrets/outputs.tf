output "secretos" {
  description = "Identificadores de los secretos, por nombre."
  value       = { for nombre, s in google_secret_manager_secret.estos : nombre => s.id }
}

output "nombres" {
  description = "Nombres de los secretos creados, para la evidencia de auditoría."
  value       = sort(keys(google_secret_manager_secret.estos))
}
