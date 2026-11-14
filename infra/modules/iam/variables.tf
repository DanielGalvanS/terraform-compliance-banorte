variable "project_id" {
  description = "Proyecto de GCP donde se crean las cuentas."
  type        = string
}

variable "cuentas" {
  description = <<-DESC
    Cuentas de servicio a crear, indexadas por identificador. Cada una declara
    los roles de proyecto que recibe; la lista vacía es válida y significa que
    la cuenta solo recibirá permisos acotados a recursos concretos.
  DESC
  type = map(object({
    descripcion = string
    roles       = optional(list(string), [])
  }))
}

# Roles que conceden control amplio sobre el proyecto. Ninguna cuenta de
# servicio de esta plataforma los necesita, y concederlos haría imposible
# sostener el principio de mínimo privilegio ante un auditor.
variable "roles_prohibidos" {
  description = "Roles que el módulo rechaza de forma explícita."
  type        = list(string)
  default = [
    "roles/owner",
    "roles/editor",
    "roles/iam.securityAdmin",
    "roles/iam.serviceAccountTokenCreator",
    "roles/resourcemanager.projectIamAdmin",
  ]
}
