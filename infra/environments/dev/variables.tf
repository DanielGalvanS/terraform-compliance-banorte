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
