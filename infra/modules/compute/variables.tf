variable "project_id" {
  description = "Proyecto de GCP donde viven las instancias."
  type        = string
}

variable "zona" {
  description = "Zona de las instancias, dentro de la región de la subred."
  type        = string
}

variable "subred" {
  description = "Identificador de la subred privada donde se conectan."
  type        = string
}

variable "cuenta_servicio" {
  description = <<-DESC
    Correo de la cuenta de servicio que usarán las instancias. Es obligatoria:
    sin ella GCP asigna la cuenta por defecto de Compute Engine, que trae el
    rol de editor sobre el proyecto entero.
  DESC
  type        = string
}

variable "instancias" {
  description = <<-DESC
    Instancias a crear, indexadas por nombre. Las pruebas de red con iperf3
    necesitan dos extremos, así que el módulo está pensado para crear varias.
  DESC
  type = map(object({
    tipo_maquina = optional(string, "e2-micro")
    disco_gb     = optional(number, 20)
  }))
}

variable "etiqueta_ssh" {
  description = "Etiqueta de red que habilita SSH por IAP, del módulo firewall."
  type        = string
  default     = "ssh-iap"
}

variable "llave_kms" {
  description = "Llave CMEK para los discos. Si se omite, GCP usa su propia llave."
  type        = string
  default     = null
}

variable "etiquetas" {
  description = "Etiquetas obligatorias de cada instancia."
  type        = map(string)

  validation {
    condition = length(setsubtract(
      ["duenio", "ambiente", "clasificacion_datos", "centro_costos", "marco_aplicable"],
      keys(var.etiquetas)
    )) == 0
    error_message = "Faltan etiquetas obligatorias: duenio, ambiente, clasificacion_datos, centro_costos, marco_aplicable."
  }
}
