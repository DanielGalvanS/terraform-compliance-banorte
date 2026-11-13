# VPC sin subredes automáticas: cada subred se declara de forma explícita para
# que ninguna región quede habilitada sin pasar por una revisión.
resource "google_compute_network" "esta" {
  project                         = var.project_id
  name                            = var.nombre
  auto_create_subnetworks         = false
  routing_mode                    = "REGIONAL"
  delete_default_routes_on_create = false
}

resource "google_compute_subnetwork" "privada" {
  project       = var.project_id
  name          = "${var.nombre}-privada"
  region        = var.region
  network       = google_compute_network.esta.id
  ip_cidr_range = var.subred_cidr

  # Permite alcanzar APIs de Google sin IP pública, que es lo que hace viable
  # una VM sin dirección externa.
  private_ip_google_access = true

  # Los flow logs son la evidencia de quién habló con quién dentro de la VPC.
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = var.retencion_flow_logs
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# El NAT da salida a internet a instancias sin IP pública. Sin él, una VM
# privada no puede ni actualizar paquetes.
resource "google_compute_router" "esta" {
  project = var.project_id
  name    = "${var.nombre}-router"
  region  = var.region
  network = google_compute_network.esta.id
}

resource "google_compute_router_nat" "esta" {
  project = var.project_id
  name    = "${var.nombre}-nat"
  router  = google_compute_router.esta.name
  region  = var.region

  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.privada.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
