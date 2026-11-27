#!/usr/bin/env bash
#
# Usuarios de Identity Platform y llave de API del navegador.
#
#   PROJECT_ID=mi-proyecto WEB_URL="$(terraform output -raw urls_web)" \
#     scripts/identidad/crear_usuarios.sh [--simular]
#
# WEB_URL acepta varias URLs separadas por comas: Cloud Run da dos al mismo
# servicio, y la llave debe servir desde cualquiera de las dos.
#
# Crea, o actualiza si ya existen, los cuatro usuarios de la plataforma, uno
# por rol, y les asigna el rol como claim personalizado (`rol`), que es lo que
# lee la API en modo jwks. Después crea la llave de API que usa el frontend
# para iniciar sesión, restringida a Identity Platform y a la URL del frontend.
#
# Requisitos: el apply ya habilitó Identity Platform (google_identity_platform_config
# en infra/environments/dev), y quien lo corre tiene permisos de administrador
# de Identity Platform y de llaves de API en el proyecto.
#
# Las contraseñas se piden por la terminal, una por usuario nuevo, y nunca se
# escriben en disco, en el historial ni en la línea de comandos. A un usuario
# que ya existe no se le cambia la contraseña: solo el nombre y el rol.
#
# Opciones:
#   --simular   muestra lo que haría, sin llamar a gcloud ni pedir contraseñas.

set -euo pipefail

SIMULAR=0
NOMBRE_LLAVE="web-login"

# correo|nombre|rol. El rol debe ser uno de los de apps/api/src/model/esquemas.ts.
USUARIOS=(
  "compliance@banorte.mx|Ana Martínez|Compliance Lead"
  "aprobador@banorte.mx|Roberto Silva|Aprobador"
  "desarrollador@banorte.mx|Carlos Vega|Desarrollador"
  "auditor@banorte.mx|Lucía Ramos|Auditor"
)

uso() {
  sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
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

if [[ -z "${PROJECT_ID:-}" || -z "${WEB_URL:-}" ]]; then
  echo "Faltan PROJECT_ID o WEB_URL. Ejemplo:" >&2
  echo "  PROJECT_ID=mi-proyecto WEB_URL=https://web-….run.app ${BASH_SOURCE[0]} --simular" >&2
  exit 2
fi

if [[ "${SIMULAR}" -eq 0 ]]; then
  for comando in gcloud curl python3; do
    if ! command -v "${comando}" >/dev/null 2>&1; then
      echo "No encuentro ${comando}." >&2
      exit 2
    fi
  done
fi

API="https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}"

titulo() {
  printf '\n==> %s\n' "$*"
}

# --- Credenciales -------------------------------------------------------------
#
# El token de acceso va en un archivo de cabeceras privado y no como argumento
# de curl: los argumentos de un proceso los puede leer cualquiera con `ps`.

CABECERAS=""
limpiar() {
  if [[ -n "${CABECERAS}" ]]; then rm -f "${CABECERAS}"; fi
}
trap limpiar EXIT

preparar_credenciales() {
  CABECERAS="$(umask 077 && mktemp)"
  {
    printf 'Authorization: Bearer %s\n' "$(gcloud auth print-access-token)"
    # Identity Platform cobra la cuota al proyecto, no a quien llama.
    printf 'x-goog-user-project: %s\n' "${PROJECT_ID}"
    printf 'Content-Type: application/json\n'
  } >"${CABECERAS}"
}

# POST a la API de Identity Platform. El cuerpo llega por stdin, para que nada
# sensible pase por la línea de comandos.
llamar() {
  curl --silent --show-error --fail-with-body \
    -H "@${CABECERAS}" --data-binary @- "${API}/$1"
}

# --- JSON ---------------------------------------------------------------------
#
# Se arma con Python y no con printf: un nombre con comillas o acentos rompería
# el JSON. Los valores viajan por variables de entorno del proceso de Python,
# nunca por sus argumentos.

json_lookup() {
  CORREO="$1" python3 -I -c 'import json,os; print(json.dumps({"email": [os.environ["CORREO"]]}))'
}

json_alta() {
  # La contraseña llega por stdin.
  CORREO="$1" NOMBRE="$2" python3 -I -c '
import json, os, sys
print(json.dumps({
    "email": os.environ["CORREO"],
    "password": sys.stdin.readline().rstrip("\n"),
    "displayName": os.environ["NOMBRE"],
    "emailVerified": True,
}))'
}

json_rol() {
  ID="$1" NOMBRE="$2" ROL="$3" python3 -I -c '
import json, os
print(json.dumps({
    "localId": os.environ["ID"],
    "displayName": os.environ["NOMBRE"],
    # customAttributes es un JSON dentro de un string: así lo pide la API.
    "customAttributes": json.dumps({"rol": os.environ["ROL"]}),
}))'
}

# Primer localId de una respuesta de lookup, o vacío si el usuario no existe.
id_de_usuario() {
  python3 -I -c '
import json, sys
usuarios = json.load(sys.stdin).get("users") or []
print(usuarios[0]["localId"] if usuarios else "")'
}

id_de_alta() {
  python3 -I -c 'import json,sys; print(json.load(sys.stdin)["localId"])'
}

pedir_contrasena() {
  local correo="$1" primera segunda
  while true; do
    read -rsp "    Contraseña para ${correo} (mínimo 12 caracteres): " primera </dev/tty
    printf '\n' >&2
    read -rsp "    Repítela: " segunda </dev/tty
    printf '\n' >&2
    if [[ "${primera}" != "${segunda}" ]]; then
      echo "    No coinciden; otra vez." >&2
    elif [[ "${#primera}" -lt 12 ]]; then
      echo "    Muy corta; otra vez." >&2
    else
      printf '%s\n' "${primera}"
      return
    fi
  done
}

# --- 1. Usuarios --------------------------------------------------------------

crear_usuarios() {
  titulo "1. Usuarios y roles"
  local entrada correo nombre rol id
  for entrada in "${USUARIOS[@]}"; do
    IFS='|' read -r correo nombre rol <<<"${entrada}"

    if [[ "${SIMULAR}" -eq 1 ]]; then
      printf '    %s: crear si no existe (pide contraseña) y asignar rol=%s\n' "${correo}" "${rol}"
      continue
    fi

    id="$(json_lookup "${correo}" | llamar "accounts:lookup" | id_de_usuario)"
    if [[ -z "${id}" ]]; then
      printf '    %s no existe; se crea.\n' "${correo}"
      id="$(pedir_contrasena "${correo}" | json_alta "${correo}" "${nombre}" | llamar "accounts" | id_de_alta)"
    else
      printf '    %s ya existe; no se toca su contraseña.\n' "${correo}"
    fi

    json_rol "${id}" "${nombre}" "${rol}" | llamar "accounts:update" >/dev/null
    printf '    %s → %s\n' "${correo}" "${rol}"
  done
}

# --- 2. Llave del navegador ---------------------------------------------------
#
# No es un secreto: termina escrita en el JavaScript del frontend. Por eso se
# restringe a lo único que debe hacer (iniciar sesión en Identity Platform) y
# a la URL desde la que se puede usar. No se crea con Terraform para que su
# valor no quede en el estado.

# Cada URL del frontend como patrón de referente: https://web-….run.app/*
referentes() {
  local url salida=""
  IFS=',' read -ra urls <<<"${WEB_URL}"
  for url in "${urls[@]}"; do
    url="${url// /}"
    salida="${salida:+${salida},}${url%/}/*"
  done
  printf '%s' "${salida}"
}

crear_llave() {
  titulo "2. Llave de API del navegador"
  if [[ "${SIMULAR}" -eq 1 ]]; then
    printf '    crear %s si no existe, solo para identitytoolkit y %s\n' "${NOMBRE_LLAVE}" "$(referentes)"
    return
  fi

  local existente
  existente="$(gcloud services api-keys list --project="${PROJECT_ID}" \
    --filter="displayName=${NOMBRE_LLAVE}" --limit=1 --format='value(name)')"
  if [[ -n "${existente}" ]]; then
    printf '    %s ya existe.\n' "${NOMBRE_LLAVE}"
  else
    gcloud services api-keys create --project="${PROJECT_ID}" \
      --display-name="${NOMBRE_LLAVE}" \
      --api-target=service=identitytoolkit.googleapis.com \
      --allowed-referrers="$(referentes)" >/dev/null
    existente="$(gcloud services api-keys list --project="${PROJECT_ID}" \
      --filter="displayName=${NOMBRE_LLAVE}" --limit=1 --format='value(name)')"
    printf '    %s creada.\n' "${NOMBRE_LLAVE}"
  fi

  cat <<EOF

    Falta un paso a mano: copiar el valor de la llave en la variable de GitHub
    IDP_API_KEY (Settings → Secrets and variables → Actions → Variables).
    Para verlo:

      gcloud services api-keys get-key-string ${existente}
EOF
}

crear_usuarios_y_llave() {
  if [[ "${SIMULAR}" -eq 0 ]]; then preparar_credenciales; fi
  crear_usuarios
  crear_llave
  titulo "Listo"
  echo "    Siguiente: login_real = true en infra/environments/dev (ver docs/despliegue.md)."
}

crear_usuarios_y_llave
