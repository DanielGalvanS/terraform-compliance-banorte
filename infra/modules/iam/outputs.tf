output "cuentas" {
  description = "Correos de las cuentas creadas, por identificador."
  value       = { for nombre, c in google_service_account.estas : nombre => c.email }
}

output "miembros" {
  description = "Cuentas en formato IAM, listas para pasarlas a otros módulos."
  value       = { for nombre, c in google_service_account.estas : nombre => "serviceAccount:${c.email}" }
}

output "roles_personalizados" {
  description = "Ruta completa de cada rol personalizado, por id."
  value       = { for id, r in google_project_iam_custom_role.estos : id => r.name }
}
