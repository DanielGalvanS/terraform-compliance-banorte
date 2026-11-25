# Un servicio de Cloud Run. El módulo se usa una vez por aplicación: la API,
# el frontend y, más adelante, el agente para el drift.
resource "google_cloud_run_v2_service" "este" {
  project  = var.project_id
  location = var.region
  name     = var.nombre
  labels   = var.etiquetas

  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.proteger_contra_borrado

  template {
    service_account = var.cuenta_servicio

    scaling {
      # Cero instancias cuando nadie lo usa: sin tráfico, no cobra CPU ni
      # memoria.
      min_instance_count = 0
      max_instance_count = var.max_instancias
    }

    containers {
      image = var.imagen_inicial

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memoria
        }
        # CPU solo mientras atiende una petición: es lo que cobra Cloud Run
        # por petición y no por instancia encendida.
        cpu_idle = true
      }

      dynamic "env" {
        for_each = var.variables_entorno
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  lifecycle {
    # La imagen la cambia el despliegue (gcloud run deploy) en cada versión.
    # Si Terraform la vigilara, cada plan querría volver a la imagen inicial.
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "publico" {
  count = var.publico ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.este.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
