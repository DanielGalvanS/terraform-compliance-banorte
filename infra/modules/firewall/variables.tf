variable "project_id" {
  description = "Proyecto de GCP donde viven las reglas."
  type        = string
}

variable "red" {
  description = "Nombre o identificador de la VPC a proteger."
  type        = string
}

variable "nombre" {
  description = "Prefijo de las reglas de firewall."
  type        = string
}

variable "subred_cidr" {
  description = "Rango de la subred, para permitir tráfico interno."
  type        = string
}

variable "etiqueta_ssh" {
  description = "Etiqueta de red que marca las instancias que aceptan SSH por IAP."
  type        = string
  default     = "ssh-iap"
}

variable "puertos_internos" {
  description = "Puertos TCP permitidos entre instancias de la misma subred."
  type        = list(string)
  default     = ["443"]
}

variable "permitir_icmp_interno" {
  description = <<-DESC
    Permite ICMP entre instancias de la subred. Hace falta para medir la
    latencia con ping en las pruebas de rendimiento; fuera de eso no aporta.
  DESC
  type        = bool
  default     = false
}
