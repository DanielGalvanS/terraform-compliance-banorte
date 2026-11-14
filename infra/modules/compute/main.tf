resource "google_compute_instance" "estas" {
  for_each = var.instancias

  project      = var.project_id
  name         = each.key
  zone         = var.zona
  machine_type = each.value.tipo_maquina
  labels       = var.etiquetas

  # Habilita SSH por IAP sin abrir el puerto a internet.
  tags = [var.etiqueta_ssh]

  boot_disk {
    # El disco también se cifra con la llave de la organización.
    kms_key_self_link = var.llave_kms

    initialize_params {
      image  = "debian-cloud/debian-12"
      size   = each.value.disco_gb
      type   = "pd-balanced"
      labels = var.etiquetas
    }
  }

  network_interface {
    subnetwork = var.subred
    # Sin bloque access_config no hay IP externa. Es deliberado: la salida va
    # por Cloud NAT y la entrada por IAP.
  }

  # Arranque verificado y monitoreo de integridad: detectan un arranque
  # alterado, que de otro modo pasaría inadvertido.
  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  service_account {
    email = var.cuenta_servicio
    # El permiso real vive en los roles de IAM de la cuenta; el scope solo
    # acota qué puede pedir el token desde la instancia.
    scopes = ["cloud-platform"]
  }

  metadata = {
    # OS Login liga el acceso SSH a identidades de IAM, en vez de a llaves
    # sueltas que nadie revoca cuando alguien deja el equipo.
    enable-oslogin = "TRUE"
    # Impide que una llave del proyecto abra esta instancia.
    block-project-ssh-keys = "TRUE"
  }

  lifecycle {
    precondition {
      condition     = var.cuenta_servicio != ""
      error_message = "Hay que indicar una cuenta de servicio: la de Compute por defecto trae rol de editor."
    }
  }
}
