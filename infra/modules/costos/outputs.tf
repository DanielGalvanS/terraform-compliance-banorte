output "presupuesto" {
  description = "Nombre completo del presupuesto en la cuenta de facturación."
  value       = google_billing_budget.mensual.name
}

output "umbrales" {
  description = "Umbrales por gasto real que disparan un aviso."
  value       = var.umbrales
}

output "canales" {
  description = "Canales de Cloud Monitoring que reciben los avisos, por correo."
  value       = { for correo, canal in google_monitoring_notification_channel.correo : correo => canal.id }
}
