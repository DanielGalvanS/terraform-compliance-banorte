variable "project_id" {
  description = "Proyecto de GCP donde vive el servicio."
  type        = string
}

variable "region" {
  description = "Región del servicio."
  type        = string
}

variable "nombre" {
  description = "Nombre del servicio. También forma su URL."
  type        = string

  validation {
    condition     = can(regex("^[a-z]([-a-z0-9]{0,47}[a-z0-9])?$", var.nombre))
    error_message = "El nombre lleva minúsculas, números y guiones, empieza con letra y no pasa de 49 caracteres."
  }
}

variable "cuenta_servicio" {
  description = <<-DESC
    Correo de la cuenta con la que corre el servicio. Es obligatoria: sin ella
    Cloud Run usa la cuenta por defecto de Compute Engine, que trae el rol de
    editor sobre el proyecto entero.
  DESC
  type        = string

  validation {
    condition     = !endswith(var.cuenta_servicio, "-compute@developer.gserviceaccount.com")
    error_message = "No se permite la cuenta por defecto de Compute Engine: tiene roles/editor. Usa una cuenta de module.iam."
  }
}

variable "imagen_inicial" {
  description = <<-DESC
    Imagen con la que se crea el servicio. Después la cambia el despliegue
    (gcloud run deploy) y Terraform no la vuelve a tocar: ver
    `lifecycle.ignore_changes` en main.tf.
  DESC
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "variables_entorno" {
  description = "Variables de entorno del contenedor. Nunca secretos: esos van en Secret Manager."
  type        = map(string)
  default     = {}
}

variable "max_instancias" {
  description = <<-DESC
    Tope de instancias. La API guarda sus datos en memoria mientras no tenga
    base de datos: con más de una instancia, cada una vería datos distintos.
  DESC
  type        = number
  default     = 1

  validation {
    condition     = var.max_instancias >= 1 && var.max_instancias <= 10
    error_message = "Entre 1 y 10 instancias: más que eso no hace falta en este reto y cuesta."
  }
}

variable "cpu" {
  description = "CPU por instancia."
  type        = string
  default     = "1"
}

variable "memoria" {
  description = "Memoria por instancia."
  type        = string
  default     = "512Mi"
}

variable "publico" {
  description = <<-DESC
    Si es true, cualquiera en internet puede llamar al servicio (allUsers con
    roles/run.invoker). El acceso lo controla la propia aplicación. Ver la
    decisión 20 de docs/decisiones.md.
  DESC
  type        = bool
  default     = false
}

variable "proteger_contra_borrado" {
  description = "Impide que Terraform borre el servicio. En dev va en false para poder destruir el ambiente."
  type        = bool
  default     = true
}

variable "etiquetas" {
  description = "Etiquetas obligatorias del servicio."
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
