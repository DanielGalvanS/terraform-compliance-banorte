output "red" {
  description = "Nombre de la VPC del ambiente."
  value       = module.red.red_nombre
}

output "instancias" {
  description = "Instancias de prueba y sus direcciones privadas."
  value       = module.compute.ips_privadas
}

output "sql_conexion" {
  description = "Nombre de conexión de Cloud SQL, para el conector."
  value       = module.sql.conexion
}

output "bucket_evidencia" {
  description = "Bucket donde se conserva la evidencia de auditoría."
  value       = module.logging.bucket
}

output "cuentas_de_servicio" {
  description = "Correos de las cuentas creadas."
  value       = module.iam.cuentas
}
