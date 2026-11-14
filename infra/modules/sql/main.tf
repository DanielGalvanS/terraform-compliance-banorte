resource "google_sql_database_instance" "esta" {
  project             = var.project_id
  name                = var.nombre
  region              = var.region
  database_version    = var.version_postgres
  deletion_protection = var.proteger_contra_borrado

  # Sin CMEK el cifrado en reposo lo controla Google por completo y la
  # organización no puede revocar el acceso a sus propios datos.
  encryption_key_name = var.llave_kms

  settings {
    tier              = var.tier
    availability_type = "ZONAL"
    disk_autoresize   = true
    disk_type         = "PD_SSD"
    user_labels       = var.etiquetas

    ip_configuration {
      # La base nunca es alcanzable desde internet: solo por IP privada dentro
      # de la VPC. Es lo que exige CO-DB-01.
      ipv4_enabled    = false
      private_network = var.red_privada
      # Rechaza conexiones que no cifren el transporte.
      ssl_mode = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled    = true
      start_time = "03:00"
      # Permite recuperar a un punto en el tiempo, no solo al último respaldo.
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = var.dias_retencion_backup
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7
      hour         = 4
      update_track = "stable"
    }

    # Registro de conexiones: sin esto no hay evidencia de quién entró a la
    # base, que es lo que piden los controles de auditoría.
    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
  }

  depends_on = [var.dependencias]

  lifecycle {
    precondition {
      condition     = var.proteger_contra_borrado || !startswith(var.nombre, "sql-mdc-prod")
      error_message = "Una instancia de producción no puede desplegarse sin protección contra borrado."
    }
  }
}
