output "llavero_id" {
  description = "Identificador del llavero."
  value       = google_kms_key_ring.este.id
}

output "llaves" {
  description = "Identificadores de las llaves, por nombre, para pasarlos a los módulos que cifran."
  value       = { for nombre, llave in google_kms_crypto_key.estas : nombre => llave.id }
}
