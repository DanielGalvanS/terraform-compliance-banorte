variable "project_id" {
  description = "Proyecto de GCP cuyo gasto se vigila."
  type        = string
}

variable "nombre" {
  description = "Prefijo del presupuesto y de los canales de aviso."
  type        = string
}

variable "cuenta_facturacion" {
  description = "ID de la cuenta de facturación (XXXXXX-XXXXXX-XXXXXX) donde vive el presupuesto."
  type        = string

  validation {
    condition     = can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.cuenta_facturacion))
    error_message = "La cuenta de facturación debe tener el formato XXXXXX-XXXXXX-XXXXXX."
  }
}

variable "monto_mensual" {
  description = "Presupuesto mensual, en unidades enteras de la moneda de la cuenta."
  type        = number

  validation {
    condition     = var.monto_mensual > 0 && floor(var.monto_mensual) == var.monto_mensual
    error_message = "El monto debe ser un entero mayor que cero."
  }
}

variable "moneda" {
  description = "Moneda del monto. Debe coincidir con la de la cuenta de facturación o GCP rechaza el presupuesto."
  type        = string
  default     = "USD"

  validation {
    condition     = can(regex("^[A-Z]{3}$", var.moneda))
    error_message = "La moneda es un código ISO 4217 de tres letras, por ejemplo USD o MXN."
  }
}

variable "umbrales" {
  description = "Fracciones del presupuesto que disparan un aviso por gasto real. 0.8 = 80 %."
  type        = list(number)
  default     = [0.5, 0.8, 1.0]

  validation {
    condition     = length(var.umbrales) > 0 && alltrue([for u in var.umbrales : u > 0])
    error_message = "Hace falta al menos un umbral y todos deben ser mayores que cero."
  }
}

variable "avisar_por_pronostico" {
  description = <<-DESC
    Avisa también cuando GCP pronostica que el mes cerrará por encima del
    presupuesto. Llega antes que el aviso por gasto real, que es justo cuando
    todavía sirve apagar algo.
  DESC
  type        = bool
  default     = true
}

variable "descontar_creditos" {
  description = <<-DESC
    Si los créditos (cupones educativos, prueba gratuita) se restan del gasto
    antes de compararlo con el presupuesto.

    En false se compara el consumo bruto. Es lo que conviene con créditos: si
    se descuentan, el gasto parece cero hasta que el crédito se agota y el
    primer aviso llega cuando ya se está pagando.
  DESC
  type        = bool
  default     = false
}

variable "correos" {
  description = "Correos que reciben los avisos. Cada uno se vuelve un canal de Cloud Monitoring."
  type        = list(string)

  validation {
    condition     = length(var.correos) > 0 && alltrue([for c in var.correos : can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", c))])
    error_message = "Hace falta al menos un correo válido."
  }
}
