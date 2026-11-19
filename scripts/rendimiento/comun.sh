#!/usr/bin/env bash
# Funciones compartidas por las pruebas de rendimiento. Se carga con source.
#
# Variables que se pueden sobrescribir al llamar a cualquier prueba:
#   CORRIDAS    corridas por prueba (el reto pide 3)
#   RESULTADOS  carpeta donde quedan los archivos crudos

set -euo pipefail

CORRIDAS="${CORRIDAS:-3}"
RESULTADOS="${RESULTADOS:-${HOME}/resultados-rendimiento}"

info() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
fallar() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

# Instala el paquete de Debian que trae un comando, solo si falta.
requerir() {
  local comando="$1" paquete="${2:-$1}"
  command -v "${comando}" >/dev/null 2>&1 && return 0
  info "instalando ${paquete}"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${paquete}" >/dev/null
}

# Lee un dato del servidor de metadatos de GCP. Fuera de GCP devuelve "desconocido".
metadato() {
  curl -sf --max-time 2 -H 'Metadata-Flavor: Google' \
    "http://metadata.google.internal/computeMetadata/v1/instance/$1" |
    awk -F/ '{print $NF}' || echo desconocido
}

# Sin las condiciones de la ejecución, los números no se pueden comparar entre
# corridas. Se anotan una vez por carpeta de resultados.
preparar_resultados() {
  mkdir -p "${RESULTADOS}"
  local archivo="${RESULTADOS}/condiciones.txt"
  [ -f "${archivo}" ] && return 0
  {
    echo "fecha_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "instancia: $(hostname)"
    echo "zona: $(metadato zone)"
    echo "tipo_maquina: $(metadato machine-type)"
    echo "corridas: ${CORRIDAS}"
  } >"${archivo}"
  info "condiciones anotadas en ${archivo}"
}
