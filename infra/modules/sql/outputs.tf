output "instancia" {
  description = "Nombre de la instancia."
  value       = google_sql_database_instance.esta.name
}

output "ip_privada" {
  description = "Dirección privada desde la que se alcanza la base."
  value       = google_sql_database_instance.esta.private_ip_address
}

output "conexion" {
  description = "Nombre de conexión, para el conector de Cloud SQL."
  value       = google_sql_database_instance.esta.connection_name
}
