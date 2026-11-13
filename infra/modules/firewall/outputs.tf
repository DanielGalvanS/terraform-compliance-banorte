output "etiqueta_ssh" {
  description = "Etiqueta de red que deben llevar las instancias para aceptar SSH por IAP."
  value       = var.etiqueta_ssh
}

output "rango_iap" {
  description = "Rango de Identity-Aware Proxy usado como único origen de SSH."
  value       = local.rango_iap
}

output "reglas" {
  description = "Nombres de las reglas creadas, para la evidencia de auditoría."
  value = [
    google_compute_firewall.denegar_ingreso.name,
    google_compute_firewall.permitir_ssh_iap.name,
    google_compute_firewall.permitir_interno.name,
  ]
}
