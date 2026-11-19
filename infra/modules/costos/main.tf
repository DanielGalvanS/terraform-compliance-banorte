# El presupuesto filtra por número de proyecto, no por ID.
data "google_project" "este" {
  project_id = var.project_id
}

# Un canal por correo. Los avisos del presupuesto llegan por Cloud Monitoring,
# así que quien los recibe no necesita permisos sobre la cuenta de facturación.
resource "google_monitoring_notification_channel" "correo" {
  for_each = toset(var.correos)

  project      = var.project_id
  display_name = "${var.nombre} presupuesto: ${each.key}"
  type         = "email"

  labels = {
    email_address = each.key
  }
}

# Un presupuesto avisa; no apaga nada. Lo que corta el gasto es destruir el
# ambiente al terminar cada sesión (ver docs/despliegue.md).
resource "google_billing_budget" "mensual" {
  billing_account = var.cuenta_facturacion
  display_name    = "${var.nombre}-mensual"

  budget_filter {
    projects               = ["projects/${data.google_project.este.number}"]
    calendar_period        = "MONTH"
    credit_types_treatment = var.descontar_creditos ? "INCLUDE_ALL_CREDITS" : "EXCLUDE_ALL_CREDITS"
  }

  amount {
    specified_amount {
      currency_code = var.moneda
      units         = tostring(var.monto_mensual)
    }
  }

  dynamic "threshold_rules" {
    for_each = var.umbrales
    content {
      threshold_percent = threshold_rules.value
      spend_basis       = "CURRENT_SPEND"
    }
  }

  dynamic "threshold_rules" {
    for_each = var.avisar_por_pronostico ? [1.0] : []
    content {
      threshold_percent = threshold_rules.value
      spend_basis       = "FORECASTED_SPEND"
    }
  }

  all_updates_rule {
    monitoring_notification_channels = [for canal in google_monitoring_notification_channel.correo : canal.id]
    # Los administradores de facturación siguen recibiendo el correo de GCP:
    # los canales se suman a ellos, no los reemplazan.
    disable_default_iam_recipients = false
  }
}
