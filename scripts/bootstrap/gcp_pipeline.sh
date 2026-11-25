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
    roles/servicenetworking.networksAdmin \
    roles/logging.configWriter \
    roles/iam.roleAdmin; do
    rol_en_proyecto "${CUENTA_APPLY}" "${rol}"
  done
  # roles/logging.configWriter: roles/editor no incluye logging.sinks.create y
  # el módulo logging crea el sink de evidencia (403 en el primer apply).
  # roles/iam.roleAdmin: ni roles/editor ni los administradores de IAM incluyen
  # iam.roles.create, y module "iam" crea el rol con el que el agente llama a
  # Vertex AI. No amplía de verdad a ci-apply: con projectIamAdmin ya podía
  # darse cualquier rol. Lo que vigila los permisos del rol es la precondición
  # del módulo (decisión 19 de docs/decisiones.md).
  rol_en_bucket_estado "${CUENTA_APPLY}" roles/storage.objectUser
}

# --- 5b. Agentes de servicio para las llaves CMEK -----------------------------

crear_agentes_servicio() {
  titulo "5b. Agentes de servicio de Cloud SQL y Secret Manager"
  # Terraform da a estos agentes permiso de usar las llaves de KMS, pero Google
  # los crea hasta que alguien los pide: sin este paso el primer apply falla
  # con "Service account service-NUMERO@gcp-sa-... does not exist" y Secret
  # Manager no acepta CMEK. Se piden aquí y no en Terraform porque requieren
  # el proveedor google-beta. Es idempotente: si ya existen, no pasa nada.
  ejecutar gcloud services enable \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    --project="${PROJECT_ID}"
  local servicio
  for servicio in sqladmin.googleapis.com secretmanager.googleapis.com; do
    ejecutar_callado gcloud beta services identity create \
      --service="${servicio}" \
      --project="${PROJECT_ID}"
  done
}

# --- 6. Pool de Workload Identity ---------------------------------------------

POOL="github"
PROVEEDOR="github"

crear_pool() {
  titulo "6. Pool de Workload Identity '${POOL}'"
  if existe gcloud iam workload-identity-pools describe "${POOL}" \
    --project="${PROJECT_ID}" --location=global; then
    echo "    Ya existe."
  else
    ejecutar gcloud iam workload-identity-pools create "${POOL}" \
      --project="${PROJECT_ID}" \
      --location=global \
      --display-name="GitHub Actions"
  fi
}

# --- 7. Proveedor OIDC --------------------------------------------------------

crear_proveedor() {
  titulo "7. Proveedor OIDC '${PROVEEDOR}' restringido a ${REPO}"
  local mapeo="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.environment=assertion.environment"
  # OBLIGATORIA. Sin esta condición, cualquier repositorio de GitHub podría
  # pedir tokens a este pool: el emisor es el mismo para todos.
  local condicion="assertion.repository=='${REPO}'"

  if existe gcloud iam workload-identity-pools providers describe "${PROVEEDOR}" \
    --project="${PROJECT_ID}" --location=global --workload-identity-pool="${POOL}"; then
    # Si ya existía se reescriben el mapeo y la condición: así un proveedor
    # creado a mano sin la condición queda corregido.
    echo "    Ya existe; se reafirman el mapeo y la condición."
    ejecutar gcloud iam workload-identity-pools providers update-oidc "${PROVEEDOR}" \
      --project="${PROJECT_ID}" \
      --location=global \
      --workload-identity-pool="${POOL}" \
      --attribute-mapping="${mapeo}" \
      --attribute-condition="${condicion}"
  else
    ejecutar gcloud iam workload-identity-pools providers create-oidc "${PROVEEDOR}" \
      --project="${PROJECT_ID}" \
      --location=global \
      --workload-identity-pool="${POOL}" \
      --display-name="GitHub Actions" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="${mapeo}" \
      --attribute-condition="${condicion}"
  fi
}

# --- 8. Quién puede hacerse pasar por cada cuenta -----------------------------

numero_proyecto() {
  if [[ "${SIMULAR}" -eq 1 ]]; then
    echo "NUMERO_DEL_PROYECTO"
  else
    gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)'
  fi
}

permitir_suplantacion() {
  local correo="$1" miembro="$2"
  echo "    roles/iam.workloadIdentityUser → ${correo%%@*}"
  echo "      para ${miembro}"
  ejecutar_callado gcloud iam service-accounts add-iam-policy-binding "${correo}" \
    --project="${PROJECT_ID}" \
    --role=roles/iam.workloadIdentityUser \
    --member="${miembro}"
}

vincular_cuentas() {
  titulo "8. Quién puede usar cada cuenta"
  local base="principalSet://iam.googleapis.com/projects/${NUMERO}/locations/global/workloadIdentityPools/${POOL}"

  # ci-plan: cualquier job del repositorio, incluidos los de pull request.
  permitir_suplantacion "${CUENTA_PLAN}" "${base}/attribute.repository/${REPO}"

  # ci-apply: SOLO los jobs que corren dentro del environment "dev" de GitHub,
  # es decir, los que pasaron por su aprobación. Un pull request cualquiera no
  # puede obtener la cuenta de escritura. Que el job sea de este repositorio
  # ya lo garantiza la condición del proveedor (paso 7).
  permitir_suplantacion "${CUENTA_APPLY}" "${base}/attribute.environment/dev"
}

# --- 9. Variables para GitHub -------------------------------------------------

imprimir_variables() {
  titulo "9. Listo"
  cat <<EOF

Configura en GitHub → Settings → Secrets and variables → Actions → Variables:

  GCP_WORKLOAD_IDENTITY_PROVIDER = projects/${NUMERO}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVEEDOR}
  GCP_SERVICE_ACCOUNT_PLAN       = ${CUENTA_PLAN}
  GCP_SERVICE_ACCOUNT_APPLY      = ${CUENTA_APPLY}
  GCP_PROJECT_ID                 = ${PROJECT_ID}
  TF_STATE_BUCKET                = ${BUCKET_ESTADO}

Y a mano: BUCKET_EVIDENCIA y CENTRO_COSTOS.
Crea también el environment "dev" en Settings → Environments.
EOF
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
  crear_agentes_servicio
  crear_pool
  crear_proveedor

  NUMERO="$(numero_proyecto)"
  vincular_cuentas
  imprimir_variables
}

main
