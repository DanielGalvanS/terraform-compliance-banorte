# Pruebas del módulo iam sin tocar GCP: el proveedor va simulado.
#
#   terraform -chdir=infra/modules/iam init -backend=false
#   terraform -chdir=infra/modules/iam test

mock_provider "google" {}

variables {
  project_id = "mdc-dev"

  roles_personalizados = {
    agenteLlamarModelo = {
      titulo      = "Agente: llamar al modelo"
      descripcion = "Solo generar respuestas con los modelos de Vertex AI"
      permisos    = ["aiplatform.endpoints.predict"]
    }
  }

  cuentas = {
    app-agente = {
      descripcion = "Agente de IA"
      roles       = ["roles/viewer", "projects/mdc-dev/roles/agenteLlamarModelo"]
    }
    app-api = {
      descripcion = "API"
      roles       = ["roles/cloudsql.client"]
    }
  }
}

run "una_asignacion_por_cuenta_y_rol" {
  command = plan

  assert {
    condition     = length(google_project_iam_member.estas) == 3
    error_message = "Debe haber una asignación por cada par cuenta y rol."
  }

  assert {
    condition     = google_project_iam_member.estas["app-agente:projects/mdc-dev/roles/agenteLlamarModelo"].role == "projects/mdc-dev/roles/agenteLlamarModelo"
    error_message = "El agente debe recibir el rol personalizado por su ruta completa."
  }
}

run "el_rol_del_agente_solo_llama_al_modelo" {
  command = plan

  assert {
    condition     = google_project_iam_custom_role.estos["agenteLlamarModelo"].permissions == toset(["aiplatform.endpoints.predict"])
    error_message = "El rol del agente debe conceder exactamente aiplatform.endpoints.predict."
  }

  assert {
    condition     = google_project_iam_custom_role.estos["agenteLlamarModelo"].project == "mdc-dev"
    error_message = "El rol se crea en el proyecto del ambiente."
  }
}

run "rechaza_un_rol_amplio" {
  command = plan

  variables {
    cuentas = {
      app-agente = {
        descripcion = "Agente de IA"
        roles       = ["roles/editor"]
      }
    }
  }

  expect_failures = [terraform_data.verificar_roles]
}

run "rechaza_un_rol_personalizado_que_cambia_iam" {
  command = plan

  variables {
    roles_personalizados = {
      atajo = {
        titulo      = "Atajo"
        descripcion = "Lo que roles/resourcemanager.projectIamAdmin concede en bloque"
        permisos    = ["aiplatform.endpoints.predict", "resourcemanager.projects.setIamPolicy"]
      }
    }
  }

  expect_failures = [terraform_data.verificar_roles]
}

run "rechaza_un_rol_personalizado_que_suplanta_cuentas" {
  command = plan

  variables {
    roles_personalizados = {
      atajo = {
        titulo      = "Atajo"
        descripcion = "Hacerse pasar por otra cuenta"
        permisos    = ["iam.serviceAccounts.getAccessToken"]
      }
    }
  }

  expect_failures = [terraform_data.verificar_roles]
}

run "rechaza_un_rol_personalizado_sin_permisos" {
  command = plan

  variables {
    roles_personalizados = {
      vacio = {
        titulo      = "Vacío"
        descripcion = "Sin permisos"
        permisos    = []
      }
    }
  }

  expect_failures = [var.roles_personalizados]
}

run "rechaza_un_rol_personalizado_que_abre_workload_identity" {
  command = plan

  variables {
    roles_personalizados = {
      atajo = {
        titulo      = "Atajo"
        descripcion = "Quitar la condición del repositorio en el proveedor"
        permisos    = ["iam.workloadIdentityPoolProviders.update"]
      }
    }
  }

  expect_failures = [terraform_data.verificar_roles]
}

run "rechaza_asignar_un_rol_personalizado_que_no_define" {
  command = plan

  variables {
    cuentas = {
      app-agente = {
        descripcion = "Agente de IA"
        roles       = ["projects/mdc-dev/roles/creadoPorFuera"]
      }
    }
  }

  expect_failures = [terraform_data.verificar_roles]
}

run "rechaza_roles_que_conceden_permisos_prohibidos" {
  command = plan

  variables {
    cuentas = {
      app-agente = {
        descripcion = "Agente de IA"
        roles       = ["roles/iam.serviceAccountUser"]
      }
    }
  }

  expect_failures = [terraform_data.verificar_roles]
}
