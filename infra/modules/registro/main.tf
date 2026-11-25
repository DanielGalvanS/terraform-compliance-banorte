# Repositorio de imágenes de contenedor para Cloud Run. Un solo repositorio
# para todas las aplicaciones; cada una sube su imagen con su propio nombre.
resource "google_artifact_registry_repository" "este" {
  project       = var.project_id
  location      = var.region
  repository_id = var.nombre
  description   = "Imágenes de las aplicaciones de la plataforma de cumplimiento"
  format        = "DOCKER"
  labels        = var.etiquetas

  # Una etiqueta (por ejemplo, el commit) siempre apunta a la misma imagen: lo
  # que se aprobó es lo que se despliega.
  docker_config {
    immutable_tags = true
  }

  # Las reglas de borrado se aplican de verdad, no solo se simulan.
  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "conservar-recientes"
    action = "KEEP"
    most_recent_versions {
      keep_count = var.versiones_a_conservar
    }
  }

  cleanup_policies {
    id     = "borrar-viejas"
    action = "DELETE"
    condition {
      older_than = "${30 * 24 * 60 * 60}s"
    }
  }
}
