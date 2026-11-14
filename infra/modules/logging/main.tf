locals {
  segundos_por_dia = 86400
}

# Bucket de evidencia: append-only por retención, no por permisos. Aunque
# alguien obtuviera acceso de escritura, no podría borrar un objeto antes de
# que venza su plazo.
resource "google_storage_bucket" "evidencia" {
  project  = var.project_id
  name     = var.nombre_bucket
  location = var.region
  labels   = var.etiquetas

  # Sin ACL por objeto: el acceso se decide solo con IAM, que es auditable.
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  retention_policy {
    retention_period = var.dias_retencion * local.segundos_por_dia
    is_locked        = var.bloquear_retencion
  }

  lifecycle {
    prevent_destroy = true
  }
}

# El sink copia los registros al bucket. Con unique_writer_identity, GCP crea
# una identidad propia para el sink en vez de reutilizar una compartida.
resource "google_logging_project_sink" "evidencia" {
  project                = var.project_id
  name                   = "${var.nombre_bucket}-sink"
  destination            = "storage.googleapis.com/${google_storage_bucket.evidencia.name}"
  unique_writer_identity = true

  # Registros de auditoría de administración y de acceso a datos.
  filter = "logName:\"cloudaudit.googleapis.com\""
}

# El sink necesita permiso explícito para escribir en el bucket.
resource "google_storage_bucket_iam_member" "escritor_del_sink" {
  bucket = google_storage_bucket.evidencia.name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.evidencia.writer_identity
}

# Sin esto, GCP registra las operaciones de administración pero no los accesos
# a datos, y no habría forma de demostrar quién leyó qué.
resource "google_project_iam_audit_config" "todos_los_servicios" {
  project = var.project_id
  service = "allServices"

  audit_log_config {
    log_type = "ADMIN_READ"
  }

  dynamic "audit_log_config" {
    for_each = var.auditar_lectura_de_datos ? ["DATA_READ", "DATA_WRITE"] : ["DATA_WRITE"]
    content {
      log_type = audit_log_config.value
    }
  }
}
