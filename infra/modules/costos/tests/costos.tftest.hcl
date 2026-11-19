# Pruebas del módulo costos sin tocar GCP: el proveedor va simulado.
#
#   terraform -chdir=infra/modules/costos init -backend=false
#   terraform -chdir=infra/modules/costos test

mock_provider "google" {
  mock_data "google_project" {
    defaults = {
      number = "123456789012"
    }
  }
}

variables {
  project_id         = "mdc-dev"
  nombre             = "mdc-dev"
  cuenta_facturacion = "01ABCD-23EF45-6789AB"
  monto_mensual      = 50
  correos            = ["equipo@example.com", "otro@example.com"]
}

run "presupuesto_por_defecto" {
  command = plan

  assert {
    condition     = google_billing_budget.mensual.budget_filter[0].projects == toset(["projects/123456789012"])
    error_message = "El presupuesto debe filtrar por el número del proyecto."
  }

  assert {
    condition     = google_billing_budget.mensual.budget_filter[0].credit_types_treatment == "EXCLUDE_ALL_CREDITS"
    error_message = "Por defecto se compara el consumo bruto, sin descontar créditos."
  }

  assert {
    condition     = google_billing_budget.mensual.amount[0].specified_amount[0].units == "50"
    error_message = "El monto debe pasar como unidades enteras."
  }

  assert {
    condition     = length(google_billing_budget.mensual.threshold_rules) == 4
    error_message = "Deben ser 3 umbrales por gasto real más 1 por pronóstico."
  }

  assert {
    condition     = length([for r in google_billing_budget.mensual.threshold_rules : r if r.spend_basis == "FORECASTED_SPEND"]) == 1
    error_message = "Debe haber exactamente un aviso por pronóstico."
  }

  assert {
    condition     = length(google_monitoring_notification_channel.correo) == 2
    error_message = "Debe haber un canal por correo."
  }
}

run "sin_pronostico_y_con_creditos" {
  command = plan

  variables {
    avisar_por_pronostico = false
    descontar_creditos    = true
  }

  assert {
    condition     = length(google_billing_budget.mensual.threshold_rules) == 3
    error_message = "Sin pronóstico solo quedan los umbrales por gasto real."
  }

  assert {
    condition     = google_billing_budget.mensual.budget_filter[0].credit_types_treatment == "INCLUDE_ALL_CREDITS"
    error_message = "Con descontar_creditos los créditos se restan del gasto."
  }
}

run "rechaza_cuenta_mal_escrita" {
  command = plan

  variables {
    cuenta_facturacion = "billingAccounts/01ABCD-23EF45-6789AB"
  }

  expect_failures = [var.cuenta_facturacion]
}

run "rechaza_correo_invalido" {
  command = plan

  variables {
    correos = ["no-es-un-correo"]
  }

  expect_failures = [var.correos]
}

run "rechaza_monto_con_decimales" {
  command = plan

  variables {
    monto_mensual = 49.5
  }

  expect_failures = [var.monto_mensual]
}
