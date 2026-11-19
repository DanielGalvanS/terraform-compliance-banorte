terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.14"
    }
  }

  # Estado remoto, cifrado y con bloqueo. GCS lo proporciona de serie.
  #
  # La configuración va vacía a propósito: el bucket y el prefijo se pasan al
  # inicializar, para que ningún identificador real quede en el repositorio.
  #
  #   terraform init -backend-config=backend.tfbackend
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Solo para el presupuesto. La API de presupuestos exige un proyecto que pague
# su cuota; sin esto responde 403 aunque los permisos estén bien.
#
# Va en un alias y no en el proveedor principal a propósito: con
# user_project_override, cada llamada exige serviceusage.services.use, que
# roles/viewer no incluye, y el plan del pipeline (cuenta ci-plan) fallaría en
# todos los recursos.
provider "google" {
  alias                 = "facturacion"
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}
