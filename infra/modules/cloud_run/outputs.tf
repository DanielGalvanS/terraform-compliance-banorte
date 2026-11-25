output "nombre" {
  description = "Nombre del servicio, para gcloud run deploy."
  value       = google_cloud_run_v2_service.este.name
}

output "url" {
  description = "URL pública del servicio (https://...run.app)."
  value       = google_cloud_run_v2_service.este.uri
}
