variable "project_id" {
  description = "Proyecto de GCP donde se crea la red."
  type        = string
}

variable "region" {
  description = "Región de la subred y del Cloud NAT."
  type        = string
}

variable "nombre" {
  description = "Nombre base de la VPC y sus recursos derivados."
  type        = string
}

variable "subred_cidr" {
  description = "Rango primario de la subred privada, en notación CIDR."
  type        = string

  validation {
    # Rangos privados de la RFC 1918: una subred del data center nunca debe
    # declararse sobre espacio público.
    condition     = can(regex("^(10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.)", var.subred_cidr))
    error_message = "La subred debe usar un rango privado (RFC 1918)."
  }
}

variable "retencion_flow_logs" {
  description = "Proporción de paquetes muestreados en los flow logs, de 0 a 1."
  type        = number
  default     = 0.5

  validation {
    condition     = var.retencion_flow_logs > 0 && var.retencion_flow_logs <= 1
    error_message = "El muestreo debe ser mayor que 0 y menor o igual que 1."
  }
}
