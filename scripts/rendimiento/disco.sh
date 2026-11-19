#!/usr/bin/env bash
# Prueba de almacenamiento: IOPS de lectura aleatoria con fio.
#
#   scripts/rendimiento/disco.sh
#
# Corre en cualquiera de las dos instancias y mide su disco de arranque.

set -euo pipefail
# shellcheck source=comun.sh
source "$(dirname "$0")/comun.sh"

TAMANIO="${TAMANIO:-1G}"
SEGUNDOS="${SEGUNDOS:-60}"
ARCHIVO_PRUEBA="${ARCHIVO_PRUEBA:-${HOME}/fio-prueba.dat}"

requerir fio
preparar_resultados

# El archivo de prueba se borra al salir, incluso si una corrida falla: deja
# 1 GB ocupado en un disco de 20.
trap 'rm -f "${ARCHIVO_PRUEBA}"' EXIT

for n in $(seq 1 "${CORRIDAS}"); do
  info "disco: corrida ${n} de ${CORRIDAS}"
  # --direct=1 salta la caché de páginas: sin él se mide la RAM, no el disco.
  # libaio con iodepth 32 mantiene la cola llena, que es como se mide el
  # máximo de IOPS que permite el disco.
  fio --name=lectura-aleatoria \
    --filename="${ARCHIVO_PRUEBA}" --size="${TAMANIO}" \
    --rw=randread --bs=4k --direct=1 \
    --ioengine=libaio --iodepth=32 --numjobs=4 \
    --time_based --runtime="${SEGUNDOS}" --group_reporting \
    --output-format=json >"${RESULTADOS}/iops-corrida-${n}.json"
done

info "listo: ${RESULTADOS}/iops-corrida-*.json"
