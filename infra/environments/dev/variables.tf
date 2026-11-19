variable "project_id" {
  description = "Proyecto de GCP del ambiente de desarrollo."
  type        = string
}

variable "region" {
  description = "Región del ambiente."
  type        = string
  default     = "us-central1"
}

variable "zona" {
  description = "Zona de las instancias de prueba."
  type        = string
  default     = "us-central1-a"
}

variable "subred_cidr" {
  description = "Rango de la subred privada."
  type        = string
  default     = "10.10.1.0/24"
}

variable "bucket_evidencia" {
  description = "Nombre del bucket de evidencia. Debe ser único en todo GCP."
  type        = string
}

variable "duenio" {
  description = "Equipo responsable, para la etiqueta obligatoria."
  type        = string
  default     = "plataforma"
}

variable "centro_costos" {
  description = "Centro de costos, para la etiqueta obligatoria."
  type        = string
}

variable "cuenta_facturacion" {
  description = "Cuenta de facturación del proyecto, para el presupuesto (XXXXXX-XXXXXX-XXXXXX)."
  type        = string
}

variable "presupuesto_mensual" {
  description = "Tope mensual de gasto de dev, en unidades enteras de la moneda."
  type        = number
  default     = 50
}

variable "moneda_facturacion" {
  description = "Moneda de la cuenta de facturación."
  type        = string
  default     = "USD"
}

variable "correos_alertas_costo" {
  description = "Correos del equipo que reciben los avisos de gasto."
  type        = list(string)
}
