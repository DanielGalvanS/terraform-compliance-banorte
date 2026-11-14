terraform {
  required_version = ">= 1.9"

  # Versiones fijas: subir de versión es un cambio explícito vía pull request.
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.14"
    }
  }
}
