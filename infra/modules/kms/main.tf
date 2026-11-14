locals {
  segundos_por_dia = 86400
}

# Un llavero no se puede borrar en GCP: destruirlo desde Terraform solo lo
# saca del estado y el recurso sigue existiendo y facturando. Por eso el
# llavero es de larga vida y las llaves se rotan dentro de él.
resource "google_kms_key_ring" "este" {
  project  = var.project_id
  name     = var.nombre
  location = var.region

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key" "estas" {
  for_each = var.llaves

  name     = each.key
  key_ring = google_kms_key_ring.este.id
  purpose  = "ENCRYPT_DECRYPT"

  # La rotación automática es lo que evita el hallazgo de "llave sin rotar".
  rotation_period = "${each.value.rotacion_dias * local.segundos_por_dia}s"

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }

  labels = var.etiquetas

  lifecycle {
    prevent_destroy = true
  }
}

# Permiso de uso acotado por llave: quien cifra datos de una base no tiene por
# qué poder descifrar los de otra.
resource "google_kms_crypto_key_iam_binding" "usuarios" {
  for_each = { for nombre, llave in var.llaves : nombre => llave if length(llave.usuarios) > 0 }

  crypto_key_id = google_kms_crypto_key.estas[each.key].id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  members       = each.value.usuarios
}
