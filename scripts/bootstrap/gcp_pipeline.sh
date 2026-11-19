#!/usr/bin/env bash
#
# Arranque del pipeline en GCP. Crea lo que el pipeline necesita ANTES de su
# primer plan y que, por eso, no puede crear el mismo Terraform que el
# pipeline aplica: el bucket del estado y las identidades de GitHub Actions.
#
#   PROJECT_ID=mi-proyecto scripts/bootstrap/gcp_pipeline.sh [--simular]
#
# Entradas (variables de entorno):
#   PROJECT_ID  obligatoria. Proyecto de GCP del ambiente dev.
#   REGION      opcional. Por defecto us-central1.
#   REPO        opcional. Repositorio de GitHub que puede pedir credenciales.
#               Por defecto DanielGalvanS/terraform-compliance-banorte.
#
# Opciones:
#   --simular   solo imprime los comandos, no ejecuta nada ni necesita gcloud.
#
# Se corre UNA vez, a mano, por alguien con rol Owner en el proyecto. Es
# idempotente: si un recurso ya existe lo dice y sigue, así que se puede volver
# a correr para corregir un permiso sin romper lo que ya está.
#
# NUNCA crea ni descarga llaves JSON de cuenta de servicio. Workload Identity
# existe justo para no tenerlas (ver CO-SEC-01).

set -euo pipefail

REGION="${REGION:-us-central1}"
REPO="${REPO:-DanielGalvanS/terraform-compliance-banorte}"
SIMULAR=0

uso() {
  sed -n '2,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "${arg}" in
    --simular) SIMULAR=1 ;;
    -h | --help)
      uso
      exit 0
      ;;
    *)
      echo "Opción desconocida: ${arg}" >&2
      uso >&2
      exit 2
      ;;
  esac
done

if [[ -z "${PROJECT_ID:-}" ]]; then
  echo "Falta PROJECT_ID. Ejemplo:" >&2
  echo "  PROJECT_ID=mi-proyecto ${BASH_SOURCE[0]} --simular" >&2
  exit 2
fi

# En modo simulación no se llama a gcloud, así que puede no estar instalado.
if [[ "${SIMULAR}" -eq 0 ]] && ! command -v gcloud >/dev/null 2>&1; then
  echo "No encuentro gcloud. Instálalo y autentícate con 'gcloud auth login'." >&2
  exit 2
fi

BUCKET_ESTADO="${PROJECT_ID}-tfstate"
CUENTA_PLAN="ci-plan@${PROJECT_ID}.iam.gserviceaccount.com"
CUENTA_APPLY="ci-apply@${PROJECT_ID}.iam.gserviceaccount.com"

# --- Utilidades ---------------------------------------------------------------

titulo() {
  printf '\n==> %s\n' "$*"
}

# Ejecuta un comando, o solo lo imprime si se está simulando.
ejecutar() {
  if [[ "${SIMULAR}" -eq 1 ]]; then
    printf '    $'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

# Igual que ejecutar, pero descarta la salida. Los add-iam-policy-binding
# imprimen la política completa y entierran lo importante.
ejecutar_callado() {
  if [[ "${SIMULAR}" -eq 1 ]]; then
    ejecutar "$@"
  else
    "$@" >/dev/null
  fi
}

# Pregunta si un recurso existe con su `describe`. Al simular se supone que no
# existe, para que la salida muestre el comando de creación.
existe() {
  if [[ "${SIMULAR}" -eq 1 ]]; then
    printf '    (comprobar: %s)\n' "$*"
    return 1
  fi
  "$@" >/dev/null 2>&1
}

# --- 1. APIs ------------------------------------------------------------------

habilitar_apis() {
  titulo "1. Habilitar las APIs del arranque"
  # `services enable` es idempotente: una API ya habilitada no da error.
  ejecutar gcloud services enable \
    iam.googleapis.com \
    iamcredentials.googleapis.com \
    sts.googleapis.com \
    cloudresourcemanager.googleapis.com \
    storage.googleapis.com \
    serviceusage.googleapis.com \
    --project="${PROJECT_ID}"
}

# --- 2. Bucket del estado -----------------------------------------------------

crear_bucket_estado() {
  titulo "2. Bucket del estado gs://${BUCKET_ESTADO}"
  if existe gcloud storage buckets describe "gs://${BUCKET_ESTADO}" --project="${PROJECT_ID}"; then
    echo "    Ya existe; se reafirma su configuración."
  else
    ejecutar gcloud storage buckets create "gs://${BUCKET_ESTADO}" \
      --project="${PROJECT_ID}" \
      --location="${REGION}" \
      --uniform-bucket-level-access \
      --public-access-prevention
  fi
  # Se aplica siempre, también sobre un bucket que ya existía: así un bucket
  # creado a mano antes de este script queda igual que uno nuevo. El versionado
  # permite recuperar un estado anterior si algo sale mal.
  ejecutar gcloud storage buckets update "gs://${BUCKET_ESTADO}" \
    --project="${PROJECT_ID}" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --versioning
}

# --- 3. Cuentas de servicio ---------------------------------------------------

# Se llaman ci-* para no chocar con las cuentas que crea Terraform en
# module "iam".
crear_cuenta() {
  local nombre="$1" descripcion="$2"
  local correo="${nombre}@${PROJECT_ID}.iam.gserviceaccount.com"
  if existe gcloud iam service-accounts describe "${correo}" --project="${PROJECT_ID}"; then
    echo "    ${correo} ya existe."
  else
    ejecutar gcloud iam service-accounts create "${nombre}" \
      --project="${PROJECT_ID}" \
      --display-name="${nombre}" \
      --description="${descripcion}"
  fi
}

crear_cuentas() {
  titulo "3. Cuentas de servicio del pipeline"
  crear_cuenta ci-plan "Pipeline: plan de Terraform, solo lectura"
  crear_cuenta ci-apply "Pipeline: aplica planes aprobados, solo desde el environment dev"
}

# --- 4 y 5. Roles -------------------------------------------------------------

# add-iam-policy-binding es idempotente: un miembro que ya tiene el rol no se
# duplica. --condition=None evita la pregunta interactiva si el proyecto ya
# tiene vínculos condicionales.
rol_en_proyecto() {
  local correo="$1" rol="$2"
  echo "    ${rol} → ${correo%%@*}"
  ejecutar_callado gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${correo}" \
    --role="${rol}" \
    --condition=None \
    --quiet
}

rol_en_bucket_estado() {
  local correo="$1" rol="$2"
  echo "    ${rol} → ${correo%%@*} (solo gs://${BUCKET_ESTADO})"
  ejecutar_callado gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_ESTADO}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${correo}" \
    --role="${rol}"
}

roles_plan() {
  titulo "4. Roles de ci-plan (solo lectura)"
  # El plan lee políticas IAM del proyecto, llaves y secretos: roles/viewer
  # solo no alcanza para todo eso.
  rol_en_proyecto "${CUENTA_PLAN}" roles/viewer
  rol_en_proyecto "${CUENTA_PLAN}" roles/iam.securityReviewer
  # Escritura SOLO en el bucket del estado: el plan toma el lock
  # (-lock-timeout=5m) y para eso tiene que crear y borrar el archivo de lock.
  rol_en_bucket_estado "${CUENTA_PLAN}" roles/storage.objectUser
}

roles_apply() {
  titulo "5. Roles de ci-apply (escritura)"
  # Esta lista se ajusta en el primer apply real. Si algo da 403, se agrega el
  # rol puntual que falta y se documenta en docs/compuerta.md. Nunca
  # roles/owner: además de todo lo demás, permitiría cambiar quién puede
  # hacerse pasar por esta misma cuenta.
  local rol
  for rol in \
    roles/editor \
    roles/resourcemanager.projectIamAdmin \
    roles/iam.serviceAccountAdmin \
    roles/cloudkms.admin \
    roles/secretmanager.admin \
    roles/servicenetworking.networksAdmin; do
    rol_en_proyecto "${CUENTA_APPLY}" "${rol}"
  done
  rol_en_bucket_estado "${CUENTA_APPLY}" roles/storage.objectUser
}

# --- Principal ----------------------------------------------------------------

main() {
  echo "Proyecto: ${PROJECT_ID}"
  echo "Región:   ${REGION}"
  echo "Repo:     ${REPO}"
  [[ "${SIMULAR}" -eq 1 ]] && echo "Modo simulación: no se ejecuta nada."

  habilitar_apis
  crear_bucket_estado
  crear_cuentas
  roles_plan
  roles_apply
}

main
