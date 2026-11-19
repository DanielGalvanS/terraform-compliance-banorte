#!/usr/bin/env bash
# Prueba de red entre las dos instancias: throughput con iperf3 y latencia con
# ping. Hace falta una de cada lado.
#
#   En vm-mdc-dev-01:  scripts/rendimiento/red.sh servidor
#   En vm-mdc-dev-02:  scripts/rendimiento/red.sh cliente IP_PRIVADA_DE_01
#
# La IP privada sale de `terraform output instancias`.

set -euo pipefail
# shellcheck source-path=SCRIPTDIR
source "$(dirname "$0")/comun.sh"

DURACION="${DURACION:-30}"
FLUJOS="${FLUJOS:-4}"

uso() { fallar "uso: $0 servidor | cliente IP_PRIVADA_DEL_SERVIDOR"; }

case "${1:-}" in
  servidor)
    requerir iperf3
    info "iperf3 escuchando en el puerto 5201. Ctrl+C para terminar."
    exec iperf3 --server
    ;;

  cliente)
    destino="${2:-}"
    [ -n "${destino}" ] || uso
    requerir iperf3
    requerir ping iputils-ping
    preparar_resultados

    for n in $(seq 1 "${CORRIDAS}"); do
      info "red: corrida ${n} de ${CORRIDAS}"
      # Latencia primero, con la red en reposo: medirla durante iperf3 daría
      # la latencia bajo carga, que es otra métrica.
      ping -c 20 -i 0.2 -q "${destino}" >"${RESULTADOS}/latencia-corrida-${n}.txt" ||
        fallar "${destino} no responde a ping. ¿Está aplicada la regla permitir-icmp-interno?"
      # Varios flujos en paralelo: un solo flujo TCP no llena el enlace y
      # mediría el límite de la ventana, no el de la red.
      salida="${RESULTADOS}/red-corrida-${n}.json"
      iperf3 --client "${destino}" --time "${DURACION}" --parallel "${FLUJOS}" \
        --json >"${salida}" || true
      # Con --json, iperf3 3.12 (el de Debian 12) termina en 0 aunque no se
      # conecte: el error solo aparece dentro del JSON.
      if grep -q '"error":' "${salida}"; then
        fallar "iperf3 no conectó con ${destino}:5201. ¿Corre red.sh servidor allá y está abierto el puerto? Detalle en ${salida}"
      fi
    done

    info "listo: ${RESULTADOS}/red-corrida-*.json y latencia-corrida-*.txt"
    ;;

  *) uso ;;
esac
