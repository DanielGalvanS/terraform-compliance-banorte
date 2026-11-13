# Rango fijo desde el que Identity-Aware Proxy abre túneles TCP. Es público y
# documentado por Google; no es un valor configurable del proyecto.
locals {
  rango_iap = "35.235.240.0/20"
}

# Deny by default. GCP trae una regla implícita de denegación, pero es
# invisible en el plan y por tanto no auditable: una regla explícita de baja
# prioridad deja el rechazo por escrito y con logs.
resource "google_compute_firewall" "denegar_ingreso" {
  project     = var.project_id
  name        = "${var.nombre}-denegar-ingreso"
  network     = var.red
  description = "Deniega todo el tráfico de entrada que ninguna regla previa haya permitido."
  direction   = "INGRESS"
  priority    = 65000

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# SSH únicamente a través de IAP. Nunca desde 0.0.0.0/0: ese es exactamente el
# incumplimiento que detecta CO-NET-01.
resource "google_compute_firewall" "permitir_ssh_iap" {
  project     = var.project_id
  name        = "${var.nombre}-permitir-ssh-iap"
  network     = var.red
  description = "Permite SSH solo desde el rango de Identity-Aware Proxy."
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = [local.rango_iap]
  target_tags   = [var.etiqueta_ssh]

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Tráfico entre instancias de la misma subred, acotado a puertos declarados.
resource "google_compute_firewall" "permitir_interno" {
  project     = var.project_id
  name        = "${var.nombre}-permitir-interno"
  network     = var.red
  description = "Permite tráfico entre instancias de la subred en puertos declarados."
  direction   = "INGRESS"
  priority    = 1100

  allow {
    protocol = "tcp"
    ports    = var.puertos_internos
  }

  source_ranges = [var.subred_cidr]

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}
