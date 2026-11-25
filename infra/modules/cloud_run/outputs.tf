output "nombre" {
  description = "Nombre del servicio, para gcloud run deploy."
  value       = google_cloud_run_v2_service.este.name
}

output "url" {
  description = "URL principal del servicio (https://...run.app)."
  value       = google_cloud_run_v2_service.este.uri
}

output "urls" {
  description = <<-DESC
    Todas las URLs del servicio. Cloud Run sirve el mismo servicio en dos
    direcciones; un navegador manda como origen la que abrió, así que el CORS
    de otro servicio debe aceptar las dos.
  DESC
  value       = google_cloud_run_v2_service.este.urls
}
