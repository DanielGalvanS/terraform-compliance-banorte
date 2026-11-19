locals {
  nombre = "mdc-dev"

  # Las cinco etiquetas que exige CO-TAG-01, en un solo sitio.
  etiquetas = {
    duenio              = var.duenio
    ambiente            = "dev"
    clasificacion_datos = "interno"
    centro_costos       = var.centro_costos
    marco_aplicable     = "cis-gcp"
  }

  # Agentes de servicio de GCP que necesitan usar las llaves CMEK. GCP los crea
  # al habilitar cada API; por eso los módulos que los usan dependen de
  # google_project_service.
  agente_sql      = "serviceAccount:service-${data.google_project.este.number}@gcp-sa-cloud-sql.iam.gserviceaccount.com"
  agente_compute  = "serviceAccount:service-${data.google_project.este.number}@compute-system.iam.gserviceaccount.com"
  agente_secretos = "serviceAccount:service-${data.google_project.este.number}@gcp-sa-secretmanager.iam.gserviceaccount.com"
}

data "google_project" "este" {
  project_id = var.project_id
}

# Sin las APIs habilitadas no existen ni los recursos ni los agentes de
# servicio que usan las llaves. disable_on_destroy queda en false: apagar una
# API al destruir el ambiente afectaría a cualquier otro recurso del proyecto.
resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
    "cloudkms.googleapis.com",
    "secretmanager.googleapis.com",
    "logging.googleapis.com",
    "storage.googleapis.com",
    "iap.googleapis.com",
    "monitoring.googleapis.com",
    "billingbudgets.googleapis.com",
  ])

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

module "red" {
  source = "../../modules/network"

  project_id  = var.project_id
  region      = var.region
  nombre      = local.nombre
  subred_cidr = var.subred_cidr

  # Cloud SQL con IP privada lo necesita.
  acceso_privado_servicios = true

  depends_on = [google_project_service.apis]
}

module "firewall" {
  source = "../../modules/firewall"

  project_id  = var.project_id
  red         = module.red.red_nombre
  nombre      = local.nombre
  subred_cidr = module.red.subred_cidr
}

module "kms" {
  source = "../../modules/kms"

  project_id = var.project_id
  region     = var.region
  nombre     = local.nombre
  etiquetas  = local.etiquetas

  llaves = {
    sql = {
      rotacion_dias = 90
      usuarios      = [local.agente_sql]
    }
    discos = {
      rotacion_dias = 90
      usuarios      = [local.agente_compute]
    }
    secretos = {
      rotacion_dias = 90
      usuarios      = [local.agente_secretos]
    }
  }

  depends_on = [google_project_service.apis]
}

module "iam" {
  source = "../../modules/iam"

  project_id = var.project_id

  # Las cuentas del pipeline (ci-plan y ci-apply) no están aquí: tienen que
  # existir antes del primer plan, así que las crea
  # scripts/bootstrap/gcp_pipeline.sh. Ver docs/decisiones.md.
  cuentas = {
    app-api = {
      descripcion = "API de cumplimiento en Cloud Run"
      roles       = ["roles/cloudsql.client", "roles/logging.logWriter"]
    }
    app-agente = {
      descripcion = "Agente de IA; solo lectura, sin permiso de aplicar"
      roles       = ["roles/viewer", "roles/logging.logWriter"]
    }
    app-pruebas = {
      descripcion = "Instancias de prueba de rendimiento"
      roles       = ["roles/logging.logWriter", "roles/monitoring.metricWriter"]
    }
  }

  depends_on = [google_project_service.apis]
}

module "secretos" {
  source = "../../modules/secrets"

  project_id = var.project_id
  region     = var.region
  etiquetas  = local.etiquetas

  secretos = {
    contrasena-sql = {
      lectores  = [module.iam.miembros["app-api"]]
      llave_kms = module.kms.llaves["secretos"]
    }
  }

  depends_on = [google_project_service.apis]
}

module "sql" {
  source = "../../modules/sql"

  project_id  = var.project_id
  region      = var.region
  nombre      = "sql-${local.nombre}-01"
  red_privada = module.red.red_id
  llave_kms   = module.kms.llaves["sql"]
  etiquetas   = local.etiquetas

  # En dev la prueba de destruir y recrear necesita poder borrarla.
  proteger_contra_borrado = false

  # La base no puede crearse antes del peering de servicios privados ni antes
  # de que el agente de Cloud SQL pueda usar la llave.
  depends_on = [module.red, module.kms]
}

module "compute" {
  source = "../../modules/compute"

  project_id      = var.project_id
  zona            = var.zona
  subred          = module.red.subred_id
  cuenta_servicio = module.iam.cuentas["app-pruebas"]
  etiqueta_ssh    = module.firewall.etiqueta_ssh
  llave_kms       = module.kms.llaves["discos"]
  etiquetas       = local.etiquetas

  # Dos extremos: iperf3 mide entre un cliente y un servidor.
  instancias = {
    "vm-${local.nombre}-01" = {}
    "vm-${local.nombre}-02" = {}
  }

  depends_on = [module.kms]
}

module "logging" {
  source = "../../modules/logging"

  project_id    = var.project_id
  region        = var.region
  nombre_bucket = var.bucket_evidencia
  etiquetas     = local.etiquetas

  # En dev la retención no se bloquea: es irreversible y aquí solo estorbaría.
  bloquear_retencion = false

  depends_on = [google_project_service.apis]
}

# Red de seguridad de gasto. El corte real es destruir el ambiente al terminar
# cada sesión; el presupuesto avisa cuando eso se olvida.
#
# Es opcional: sin cuenta de facturación ni correos no se crea, y el resto del
# ambiente se planea igual. Así no se rompe el plan de quien no tiene acceso a
# la cuenta de facturación.
module "costos" {
  source = "../../modules/costos"
  count  = var.cuenta_facturacion != null && length(var.correos_alertas_costo) > 0 ? 1 : 0

  providers = {
    google = google.facturacion
  }

  project_id         = var.project_id
  nombre             = local.nombre
  cuenta_facturacion = var.cuenta_facturacion
  monto_mensual      = var.presupuesto_mensual
  moneda             = var.moneda_facturacion
  correos            = var.correos_alertas_costo

  depends_on = [google_project_service.apis]
}
