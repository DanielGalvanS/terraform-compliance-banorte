locals {
  # Aplana cuentas y roles para poder crear una asignación por par.
  asignaciones = merge([
    for nombre, cuenta in var.cuentas : {
      for rol in cuenta.roles : "${nombre}:${rol}" => {
        cuenta = nombre
        rol    = rol
      }
    }
  ]...)

  roles_solicitados = distinct(flatten([for c in var.cuentas : c.roles]))
  roles_vetados     = [for rol in local.roles_solicitados : rol if contains(var.roles_prohibidos, rol)]
}

# Corta el despliegue antes de crear nada si alguien pide un rol amplio.
# La comprobación vive aquí y no en una validación de variable porque depende
# de dos variables a la vez.
resource "terraform_data" "verificar_roles" {
  lifecycle {
    precondition {
      condition     = length(local.roles_vetados) == 0
      error_message = "Roles prohibidos por mínimo privilegio: ${join(", ", local.roles_vetados)}."
    }
  }
}

resource "google_service_account" "estas" {
  for_each = var.cuentas

  project      = var.project_id
  account_id   = each.key
  display_name = each.value.descripcion
  description  = each.value.descripcion

  depends_on = [terraform_data.verificar_roles]
}

# iam_member y no iam_binding: binding es autoritativo sobre el rol completo y
# borraría de un plumazo a cualquier otro miembro que lo tuviera, incluidos los
# agentes de servicio que GCP administra solo.
resource "google_project_iam_member" "estas" {
  for_each = local.asignaciones

  project = var.project_id
  role    = each.value.rol
  member  = "serviceAccount:${google_service_account.estas[each.value.cuenta].email}"
}
