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
  description = "Cuenta de facturación del proyecto, para el presupuesto (XXXXXX-XXXXXX-XXXXXX). Sin ella no se crea el presupuesto."
  type        = string
  default     = null
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
  description = "Correos del equipo que reciben los avisos de gasto. Sin ellos no se crea el presupuesto."
  type        = list(string)
  default     = []
}

variable "login_real" {
  description = <<-DESC
    La API verifica los tokens de Identity Platform (AUTH_MODO=jwks) en vez de
    aceptar los usuarios de demostración.

    Se activa DESPUÉS de crear los usuarios y la llave del navegador con
    scripts/identidad/crear_usuarios.sh: si se activa antes, nadie puede
    entrar. Ver docs/despliegue.md.
  DESC
  type        = bool
  default     = false
}
