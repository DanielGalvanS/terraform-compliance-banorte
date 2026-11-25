# Pruebas del módulo registro sin tocar GCP: el proveedor va simulado.
#
#   terraform -chdir=infra/modules/registro init -backend=false
#   terraform -chdir=infra/modules/registro test

mock_provider "google" {}

variables {
  project_id = "mdc-dev"
  region     = "us-central1"
  nombre     = "contenedores"
  etiquetas = {
    duenio              = "plataforma"
    ambiente            = "dev"
    clasificacion_datos = "interno"
    centro_costos       = "cc-0001"
    marco_aplicable     = "cis-gcp"
  }
}

run "repositorio_docker_con_etiquetas_inmutables" {
  command = plan

  assert {
    condition     = google_artifact_registry_repository.este.format == "DOCKER"
    error_message = "Es un repositorio de imágenes de contenedor."
  }

  assert {
    condition     = google_artifact_registry_repository.este.docker_config[0].immutable_tags == true
    error_message = "Una etiqueta no debe poder apuntar después a otra imagen."
  }

  assert {
    condition     = output.url == "us-central1-docker.pkg.dev/mdc-dev/contenedores"
    error_message = "La URL es el prefijo de las imágenes."
  }
}

run "borra_las_imagenes_viejas_de_verdad" {
  command = plan

  assert {
    condition     = google_artifact_registry_repository.este.cleanup_policy_dry_run == false
    error_message = "Las reglas de borrado deben aplicarse, no solo simularse."
  }

  assert {
    condition     = one([for p in google_artifact_registry_repository.este.cleanup_policies : p.most_recent_versions[0].keep_count if p.action == "KEEP"]) == 5
    error_message = "Por defecto se conservan las 5 versiones más recientes."
  }
}

run "conserva_al_menos_dos_versiones" {
  command = plan

  variables {
    versiones_a_conservar = 1
  }

  expect_failures = [var.versiones_a_conservar]
}
