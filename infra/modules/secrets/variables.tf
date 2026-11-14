variable "project_id" {
  description = "Proyecto de GCP donde viven los secretos."
  type        = string
}

variable "region" {
  description = <<-DESC
    Región donde se replican los secretos. La replicación es administrada por
    el usuario y no automática, para que el dato no salga de la región elegida:
    la residencia es un requisito de LFPDPPP y de las disposiciones de CNBV.
  DESC
  type        = string
}

variable "secretos" {
  description = <<-DESC
    Secretos a crear, indexados por nombre. El módulo crea únicamente el
    contenedor: el valor NUNCA se declara aquí.
  DESC
  type = map(object({
    # Miembros que pueden leer el valor, en formato IAM.
    lectores = optional(list(string), [])
    # Llave CMEK con la que se cifra la réplica. Si se omite, GCP usa su
    # propia llave administrada.
    llave_kms = optional(string)
  }))
  default = {}
}

variable "etiquetas" {
  description = "Etiquetas obligatorias que llevará cada secreto."
  type        = map(string)

  validation {
    condition = length(setsubtract(
      ["duenio", "ambiente", "clasificacion_datos", "centro_costos", "marco_aplicable"],
      keys(var.etiquetas)
    )) == 0
    error_message = "Faltan etiquetas obligatorias: duenio, ambiente, clasificacion_datos, centro_costos, marco_aplicable."
  }
}
