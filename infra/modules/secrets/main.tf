# El módulo crea el contenedor del secreto, nunca su valor.
#
# Declarar un valor aquí lo dejaría en el estado de Terraform en texto plano y
# en el historial de git, que es exactamente lo que prohíbe la convención del
# reto. Las versiones se cargan fuera de Terraform:
#
#   gcloud secrets versions add NOMBRE --data-file=- < /dev/stdin
#
# o desde el pipeline, con credenciales de corta vida.
resource "google_secret_manager_secret" "estos" {
  for_each = var.secretos

  project   = var.project_id
  secret_id = each.key
  labels    = var.etiquetas

  replication {
    user_managed {
      replicas {
        location = var.region

        dynamic "customer_managed_encryption" {
          for_each = each.value.llave_kms == null ? [] : [each.value.llave_kms]
          content {
            kms_key_name = customer_managed_encryption.value
          }
        }
      }
    }
  }
}

# Acceso de solo lectura al valor, acotado por secreto. Nadie recibe permisos
# a nivel proyecto: un lector de la contraseña de la base no debe poder leer
# las llaves de la API.
resource "google_secret_manager_secret_iam_binding" "lectores" {
  for_each = { for nombre, s in var.secretos : nombre => s if length(s.lectores) > 0 }

  project   = var.project_id
  secret_id = google_secret_manager_secret.estos[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  members   = each.value.lectores
}
