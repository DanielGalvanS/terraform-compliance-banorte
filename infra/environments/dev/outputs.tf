output "red" {
  description = "Nombre de la VPC del ambiente."
  value       = module.red.red_nombre
}

output "instancias" {
  description = "Instancias de prueba y sus direcciones privadas."
  value       = module.compute.ips_privadas
}

output "sql_ip_privada" {
  description = "IP privada de Cloud SQL, para la prueba de rendimiento con pgbench."
  value       = module.sql.ip_privada
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

output "repositorio_imagenes" {
  description = "Prefijo de las imágenes de contenedor."
  value       = module.registro.url
}

output "url_api" {
  description = "URL pública de la API en Cloud Run."
  value       = module.api.url
}

output "url_web" {
  description = "URL pública del frontend en Cloud Run."
  value       = module.web.url
}

output "servicios_cloud_run" {
  description = "Nombres de los servicios, para gcloud run deploy."
  value       = { api = module.api.nombre, web = module.web.nombre }
}


output "identidad" {
  description = "Emisor y audiencia de los tokens de Identity Platform que acepta la API."
  value = {
    emisor    = local.identidad.emisor
    audiencia = local.identidad.audiencia
  }
}
