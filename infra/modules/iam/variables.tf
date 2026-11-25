variable "project_id" {
  description = "Proyecto de GCP donde se crean las cuentas."
  type        = string
}

variable "cuentas" {
  description = <<-DESC
    Cuentas de servicio a crear, indexadas por identificador. Cada una declara
    los roles de proyecto que recibe; la lista vacía es válida y significa que
    la cuenta solo recibirá permisos acotados a recursos concretos. Un rol de
    `roles_personalizados` se pide con su ruta completa:
    `projects/<proyecto>/roles/<id>`.
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
    # Conceden en bloque los permisos de permisos_prohibidos.
    "roles/iam.roleAdmin",
    "roles/iam.serviceAccountUser",
    "roles/iam.serviceAccountKeyAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
  ]
}

# Para cuando ningún rol de Google es lo bastante chico. El ejemplo es el
# agente: el rol más acotado de Vertex AI que permite llamar a un modelo
# también deja crear datasets, motores y sesiones.
variable "roles_personalizados" {
  description = <<-DESC
    Roles de proyecto a crear, indexados por su id (letras, números, `_` y
    `.`). Cada uno lista exactamente los permisos que concede.
  DESC
  type = map(object({
    titulo      = string
    descripcion = string
    permisos    = list(string)
  }))
  default = {}

  validation {
    condition     = alltrue([for id, _ in var.roles_personalizados : can(regex("^[a-zA-Z0-9_.]{3,64}$", id))])
    error_message = "El id de un rol personalizado lleva de 3 a 64 caracteres: letras, números, _ y ."
  }

  validation {
    condition     = alltrue([for _, r in var.roles_personalizados : length(r.permisos) > 0])
    error_message = "Un rol personalizado sin permisos no sirve para nada."
  }
}

# Lo mismo que roles_prohibidos, pero por permiso: sin esta lista un rol
# personalizado podría llevar suelto lo que esos roles conceden en bloque.
# Cubre cambiar la política de IAM de cualquier recurso (*.setIamPolicy, aparte),
# hacerse pasar por otra cuenta, crear o ampliar roles y las rutas que llegan a
# una cuenta con más permisos sin pedir actAs.
variable "permisos_prohibidos" {
  description = "Permisos que ningún rol personalizado puede incluir, además de cualquier *.setIamPolicy."
  type        = list(string)
  default = [
    "iam.serviceAccounts.actAs",
    "iam.serviceAccounts.getAccessToken",
    "iam.serviceAccounts.getOpenIdToken",
    "iam.serviceAccounts.implicitDelegation",
    "iam.serviceAccounts.signBlob",
    "iam.serviceAccounts.signJwt",
    "iam.serviceAccountKeys.create",
    "iam.roles.create",
    "iam.roles.update",
    "iam.roles.undelete",
    # Escalan sin pasar por actAs: cambiar el proveedor de Workload Identity
    # deja que otro repositorio de GitHub se haga pasar por ci-apply; Deployment
    # Manager y Cloud Build corren con cuentas que ya tienen roles amplios; una
    # llave HMAC da acceso a los buckets como otra cuenta, incluido el estado;
    # cambiar los metadatos de una VM permite meter una llave SSH y tomar el
    # token de la cuenta con la que corre.
    "iam.workloadIdentityPoolProviders.create",
    "iam.workloadIdentityPoolProviders.update",
    "deploymentmanager.deployments.create",
    "cloudbuild.builds.create",
    "storage.hmacKeys.create",
    "compute.instances.setMetadata",
    "compute.projects.setCommonInstanceMetadata",
  ]
}
