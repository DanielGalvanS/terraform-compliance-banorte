output "red_id" {
  description = "Identificador de la VPC, para los módulos que se conectan a ella."
  value       = google_compute_network.esta.id
}

output "red_nombre" {
  description = "Nombre de la VPC."
  value       = google_compute_network.esta.name
}

output "subred_id" {
  description = "Identificador de la subred privada."
  value       = google_compute_subnetwork.privada.id
}

output "subred_cidr" {
  description = "Rango de la subred privada, para componer reglas de firewall."
  value       = google_compute_subnetwork.privada.ip_cidr_range
}

output "acceso_privado_servicios_listo" {
  description = "Si el peering de servicios privados está creado, para que Cloud SQL dependa de él."
  value       = var.acceso_privado_servicios ? google_service_networking_connection.servicios_privados[0].id : null
}
