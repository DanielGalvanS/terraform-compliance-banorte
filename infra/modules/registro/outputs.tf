output "url" {
  description = "Prefijo de las imágenes: <region>-docker.pkg.dev/<proyecto>/<repositorio>."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.este.repository_id}"
}
