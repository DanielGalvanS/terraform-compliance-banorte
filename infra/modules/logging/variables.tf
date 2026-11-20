variable "project_id" {
  description = "Proyecto de GCP cuyos registros se conservan."
  type        = string
}

variable "region" {
  description = "Región del bucket. Fija la residencia de los registros."
  type        = string
}

variable "nombre_bucket" {
  description = "Nombre del bucket de evidencia. Debe ser único en todo GCP."
  type        = string
}

variable "dias_retencion" {
  description = "Días que los registros no se pueden borrar."
  type        = number
  default     = 365

  validation {
    condition     = var.dias_retencion >= 90
    error_message = "La retención mínima es de 90 días."
  }
}

variable "bloquear_retencion" {
  description = <<-DESC
    Bloquea la política de retención del bucket.

    ES IRREVERSIBLE. Una vez bloqueada, la retención no se puede acortar ni
    quitar, y el bucket no se puede borrar hasta que venza el plazo de cada
    objeto. Es lo que hace que la evidencia sea realmente inmutable, y también
    lo que impide deshacer un error.

    Se deja en false por defecto a propósito: en dev y qa bloquearlo solo
    estorba. Se activa en producción, cuando Cumplimiento haya confirmado el
    plazo según el marco más estricto aplicable.
  DESC
  type        = bool
  default     = false
}

variable "auditar_lectura_de_datos" {
  description = <<-DESC
    Registra también los accesos de lectura a datos. Es lo que permite
    demostrar quién consultó qué, pero multiplica el volumen y el costo.
  DESC
  type        = bool
  default     = true
}

variable "etiquetas" {
  description = "Etiquetas obligatorias del bucket."
  type        = map(string)

  validation {
    condition = length(setsubtract(
      ["duenio", "ambiente", "clasificacion_datos", "centro_costos", "marco_aplicable"],
      keys(var.etiquetas)
    )) == 0
    error_message = "Faltan etiquetas obligatorias: duenio, ambiente, clasificacion_datos, centro_costos, marco_aplicable."
  }
}

variable "escritores" {
  description = <<-DESC
    Identidades que escriben evidencia en el bucket, por nombre:
    { app-api = "serviceAccount:…" }. Reciben roles/storage.objectCreator, que
    crea objetos pero no los borra ni los sobrescribe.

    Es un mapa y no una lista porque el correo de una cuenta recién creada no
    se conoce hasta el apply, y for_each necesita claves conocidas en el plan.
  DESC
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for m in values(var.escritores) : can(regex("^(serviceAccount|group|user):", m))])
    error_message = "Cada escritor debe ser un miembro de IAM: serviceAccount:, group: o user:."
  }
}

variable "lectores" {
  description = <<-DESC
    Identidades que leen la evidencia, por nombre. Reciben
    roles/storage.objectViewer. La API lo necesita para reconstruir y
    verificar la cadena de hashes al arrancar y en GET /evidencia.
  DESC
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for m in values(var.lectores) : can(regex("^(serviceAccount|group|user):", m))])
    error_message = "Cada lector debe ser un miembro de IAM: serviceAccount:, group: o user:."
  }
}
