#!/usr/bin/env bash
# Prueba de Cloud SQL: latencia media de transacción con pgbench.
#
#   scripts/rendimiento/sql.sh IP_PRIVADA_SQL USUARIO [BASE]
#
# La IP sale de `terraform output sql_ip_privada`. La contraseña se pide por teclado o se
# toma de PGPASSWORD; nunca se guarda en un archivo. Para obtenerla desde tu
# equipo, con permisos sobre el secreto:
#
#   gcloud secrets versions access latest --secret=contrasena-sql
#
# La cuenta de servicio de las VMs no puede leer el secreto, a propósito: solo
# la API tiene ese permiso.

set -euo pipefail
# shellcheck source-path=SCRIPTDIR
source "$(dirname "$0")/comun.sh"

host="${1:-}"
usuario="${2:-}"
base="${3:-postgres}"
[ -n "${host}" ] && [ -n "${usuario}" ] || fallar "uso: $0 IP_PRIVADA_SQL USUARIO [BASE]"

CLIENTES="${CLIENTES:-10}"
HILOS="${HILOS:-2}"
SEGUNDOS="${SEGUNDOS:-60}"
ESCALA="${ESCALA:-10}"

# Cloud SQL está en ssl_mode ENCRYPTED_ONLY: sin TLS rechaza la conexión.
export PGSSLMODE="${PGSSLMODE:-require}"
export PGHOST="${host}" PGUSER="${usuario}" PGDATABASE="${base}"

if [ -z "${PGPASSWORD:-}" ]; then
  read -rsp "Contraseña de ${usuario}: " PGPASSWORD
  echo >&2
  export PGPASSWORD
fi

# En Debian, pgbench no viene en postgresql-client sino con el servidor. Ojo:
# /usr/bin/pgbench existe aunque no esté instalado (es un envoltorio de
# postgresql-client-common), así que se comprueba que funcione, no que exista.
# El servicio local se detiene para que no compita por la RAM de la VM.
if ! pgbench --version >/dev/null 2>&1; then
  info "instalando pgbench (paquete postgresql)"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql >/dev/null
  sudo systemctl disable --now postgresql >/dev/null 2>&1 || true
fi
preparar_resultados

# Las tablas de pgbench se crean una sola vez. Con SALTAR_INICIO=1 se reutilizan
# las de una sesión anterior.
if [ "${SALTAR_INICIO:-0}" != "1" ]; then
  info "sql: creando tablas de prueba (escala ${ESCALA})"
  pgbench --initialize --scale="${ESCALA}" --quiet
fi

for n in $(seq 1 "${CORRIDAS}"); do
  info "sql: corrida ${n} de ${CORRIDAS}"
  pgbench --client="${CLIENTES}" --jobs="${HILOS}" --time="${SEGUNDOS}" \
    --progress=10 >"${RESULTADOS}/sql-corrida-${n}.txt" 2>"${RESULTADOS}/sql-corrida-${n}.log"
done

info "listo: ${RESULTADOS}/sql-corrida-*.txt"
