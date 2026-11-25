variable "project_id" {
  description = "Proyecto de GCP donde vive el repositorio."
  type        = string
}

variable "region" {
  description = "Región del repositorio. La misma que la de Cloud Run: así las imágenes no cruzan regiones."
  type        = string
}

variable "nombre" {
  description = "Nombre del repositorio de imágenes."
  type        = string
}

variable "versiones_a_conservar" {
  description = <<-DESC
    Cuántas imágenes recientes se conservan por aplicación. Las demás se
    borran solas: cada despliegue sube una imagen, y el almacenamiento cobra.
  DESC
  type        = number
  default     = 5

  validation {
    # Con menos de 2 no habría a qué volver si la última versión falla.
    condition     = var.versiones_a_conservar >= 2
    error_message = "Conserva al menos 2 versiones para poder volver a la anterior."
  }
}

variable "etiquetas" {
  description = "Etiquetas obligatorias del repositorio."
  type        = map(string)

  validation {
    # Mismo conjunto que exige la política CO-TAG-01.
    condition = length(setsubtract(
      ["duenio", "ambiente", "clasificacion_datos", "centro_costos", "marco_aplicable"],
      keys(var.etiquetas)
    )) == 0
    error_message = "Faltan etiquetas obligatorias: duenio, ambiente, clasificacion_datos, centro_costos, marco_aplicable."
  }
}
