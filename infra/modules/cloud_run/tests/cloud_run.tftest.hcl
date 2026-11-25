# Pruebas del módulo cloud_run sin tocar GCP: el proveedor va simulado.
#
#   terraform -chdir=infra/modules/cloud_run init -backend=false
#   terraform -chdir=infra/modules/cloud_run test

mock_provider "google" {}

variables {
  project_id      = "mdc-dev"
  region          = "us-central1"
  nombre          = "api-mdc-dev"
  cuenta_servicio = "app-api@mdc-dev.iam.gserviceaccount.com"
  etiquetas = {
    duenio              = "plataforma"
    ambiente            = "dev"
    clasificacion_datos = "interno"
    centro_costos       = "cc-0001"
    marco_aplicable     = "cis-gcp"
  }
}

run "por_defecto_privado_una_instancia_y_escala_a_cero" {
  command = plan

  assert {
    condition     = length(google_cloud_run_v2_service_iam_member.publico) == 0
    error_message = "Sin publico = true nadie de internet debe poder llamarlo."
  }

  assert {
    condition     = google_cloud_run_v2_service.este.template[0].scaling[0].max_instance_count == 1
    error_message = "Por defecto una sola instancia: la API guarda datos en memoria."
  }

  assert {
    condition     = google_cloud_run_v2_service.este.template[0].scaling[0].min_instance_count == 0
    error_message = "Sin tráfico debe quedar en cero instancias."
  }

  assert {
    condition     = google_cloud_run_v2_service.este.template[0].service_account == "app-api@mdc-dev.iam.gserviceaccount.com"
    error_message = "Debe correr con la cuenta que se le pasa."
  }

  assert {
    condition     = google_cloud_run_v2_service.este.deletion_protection == true
    error_message = "Por defecto protegido contra borrado."
  }

  assert {
    condition     = google_cloud_run_v2_service.este.labels["ambiente"] == "dev"
    error_message = "Lleva las etiquetas obligatorias."
  }
}

run "publico_da_run_invoker_a_allusers" {
  command = plan

  variables {
    publico = true
  }

  assert {
    condition     = google_cloud_run_v2_service_iam_member.publico[0].member == "allUsers"
    error_message = "Público significa allUsers."
  }

  assert {
    condition     = google_cloud_run_v2_service_iam_member.publico[0].role == "roles/run.invoker"
    error_message = "Solo el permiso de invocar, nada más."
  }
}

run "las_variables_de_entorno_llegan_al_contenedor" {
  command = plan

  variables {
    variables_entorno = { EVIDENCIA_BUCKET = "bucket-evidencia" }
  }

  assert {
    condition     = one([for e in google_cloud_run_v2_service.este.template[0].containers[0].env : e.value if e.name == "EVIDENCIA_BUCKET"]) == "bucket-evidencia"
    error_message = "Cada variable de entorno debe llegar al contenedor."
  }
}

run "rechaza_la_cuenta_por_defecto_de_compute" {
  command = plan

  variables {
    cuenta_servicio = "123456789012-compute@developer.gserviceaccount.com"
  }

  expect_failures = [var.cuenta_servicio]
}

run "rechaza_un_servicio_sin_etiquetas" {
  command = plan

  variables {
    etiquetas = { ambiente = "dev" }
  }

  expect_failures = [var.etiquetas]
}

run "rechaza_demasiadas_instancias" {
  command = plan

  variables {
    max_instancias = 50
  }

  expect_failures = [var.max_instancias]
}
