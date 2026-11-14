variable "project_id" {
  description = "Proyecto de GCP donde vive el llavero."
  type        = string
}

variable "region" {
  description = "Región del llavero. Debe coincidir con la de los recursos que cifra."
  type        = string
}

variable "nombre" {
  description = "Nombre del llavero."
  type        = string
}

variable "llaves" {
  description = <<-DESC
    Llaves a crear, indexadas por nombre. Cada una define su periodo de
    rotación en días y quién puede usarla.
  DESC
  type = map(object({
    rotacion_dias = optional(number, 90)
    # Miembros que pueden cifrar y descifrar con la llave, en formato IAM
    # (por ejemplo "serviceAccount:sql@proyecto.iam.gserviceaccount.com").
    usuarios = optional(list(string), [])
  }))

  validation {
    condition     = alltrue([for l in var.llaves : l.rotacion_dias >= 1 && l.rotacion_dias <= 365])
    error_message = "La rotación debe estar entre 1 y 365 días."
  }
}

variable "etiquetas" {
  description = "Etiquetas obligatorias que llevará cada llave."
  type        = map(string)

  validation {
    # Mismo conjunto que exige la política CO-TAG-01. Validarlo aquí hace que
    # el error aparezca en `terraform plan`, antes de llegar a la compuerta.
    condition = length(setsubtract(
      ["duenio", "ambiente", "clasificacion_datos", "centro_costos", "marco_aplicable"],
      keys(var.etiquetas)
    )) == 0
    error_message = "Faltan etiquetas obligatorias: duenio, ambiente, clasificacion_datos, centro_costos, marco_aplicable."
  }
}
