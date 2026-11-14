variable "project_id" {
  description = "Proyecto de GCP donde vive la instancia."
  type        = string
}

variable "region" {
  description = "Región de la instancia. Debe coincidir con la de la llave CMEK."
  type        = string
}

variable "nombre" {
  description = "Nombre de la instancia."
  type        = string
}

variable "red_privada" {
  description = "Identificador de la VPC desde la que se alcanza la base."
  type        = string
}

variable "llave_kms" {
  description = <<-DESC
    Llave CMEK con la que se cifra la instancia. Es obligatoria: sin ella el
    cifrado lo controla Google por completo, que es lo que rechaza CO-DB-02.
  DESC
  type        = string

  validation {
    condition     = can(regex("^projects/.+/locations/.+/keyRings/.+/cryptoKeys/.+$", var.llave_kms))
    error_message = "La llave debe ser una ruta completa de KMS: projects/.../locations/.../keyRings/.../cryptoKeys/..."
  }
}

variable "version_postgres" {
  description = "Versión de PostgreSQL."
  type        = string
  default     = "POSTGRES_15"
}

variable "tier" {
  description = "Tamaño de la instancia."
  type        = string
  default     = "db-g1-small"
}

variable "dias_retencion_backup" {
  description = "Días que se conservan los respaldos."
  type        = number
  default     = 30

  validation {
    condition     = var.dias_retencion_backup >= 7
    error_message = "La retención mínima es de 7 días."
  }
}

variable "proteger_contra_borrado" {
  description = <<-DESC
    Impide destruir la instancia. Se deja en true salvo en ambientes
    efímeros, donde la prueba de destruir y recrear necesita apagarlo.
  DESC
  type        = bool
  default     = true
}

variable "etiquetas" {
  description = "Etiquetas obligatorias de la instancia."
  type        = map(string)

  validation {
    condition = length(setsubtract(
      ["duenio", "ambiente", "clasificacion_datos", "centro_costos", "marco_aplicable"],
      keys(var.etiquetas)
    )) == 0
    error_message = "Faltan etiquetas obligatorias: duenio, ambiente, clasificacion_datos, centro_costos, marco_aplicable."
  }
}
