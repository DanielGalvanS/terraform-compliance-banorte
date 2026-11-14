#!/usr/bin/env bash
#
# Compuerta de políticas. Evalúa un plan de Terraform en JSON contra el
# catálogo de controles y escribe el veredicto.
#
#   policy_check.sh <plan.json> [veredicto.json]
#
# FALLA SEGURA: cualquier salida distinta de "conforme" termina con código
# distinto de cero. Eso incluye los errores del propio evaluador: si conftest
# no está, el plan no se puede leer o el proceso muere a mitad, el veredicto es
# "error" y el despliegue se bloquea. Un evaluador que no puede opinar nunca
# autoriza (caso de prueba CP-15).

set -euo pipefail

PLAN="${1:-}"
VEREDICTO="${2:-veredicto.json}"
POLITICAS="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../policies" && pwd)"

# Escribe el veredicto y termina. Se usa también desde la trampa de error, así
# que nunca debe depender de estado a medio construir.
emitir() {
  local resultado="$1" motivo="$2" violaciones="${3:-[]}" codigo="$4"
  python3 - "$VEREDICTO" "$resultado" "$motivo" "$violaciones" <<'PY'
import json, subprocess, sys, datetime

destino, resultado, motivo, violaciones = sys.argv[1:5]

def git(*args):
    try:
        return subprocess.run(("git",) + args, capture_output=True, text=True,
                              check=True).stdout.strip()
    except Exception:
        return "desconocido"

json.dump({
    "resultado": resultado,
    "motivo": motivo,
    "fecha": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "commit": git("rev-parse", "HEAD"),
    "actor": git("log", "-1", "--pretty=%an"),
    "violaciones": json.loads(violaciones),
}, open(destino, "w"), indent=2, ensure_ascii=False)
PY
  echo "veredicto: $resultado ($motivo) -> $VEREDICTO" >&2
  exit "$codigo"
}

# Cualquier fallo no previsto bloquea.
trap 'emitir error "El evaluador terminó de forma inesperada" "[]" 1' ERR

[[ -n "$PLAN" ]] || emitir error "No se indicó el plan a evaluar" "[]" 2
[[ -f "$PLAN" ]] || emitir error "No se encontró el plan: $PLAN" "[]" 2
command -v conftest >/dev/null || emitir error "conftest no está instalado" "[]" 2
command -v python3 >/dev/null || emitir error "python3 no está instalado" "[]" 2

# conftest devuelve 1 cuando hay violaciones; se captura sin que `set -e` corte.
salida=""
estado=0
salida="$(conftest test --policy "$POLITICAS/rego" --output json --no-color "$PLAN" 2>&1)" || estado=$?

# Un código mayor que 1 no es un incumplimiento, es un fallo del evaluador.
if (( estado > 1 )); then
  emitir error "conftest falló con código $estado: ${salida:0:300}" "[]" 1
fi

# Si la salida no es JSON legible, tampoco se puede afirmar que haya conformidad.
violaciones="$(python3 - "$salida" <<'PY' 2>/dev/null || echo FALLO
import json, sys
try:
    resultados = json.loads(sys.argv[1])
except Exception:
    print("FALLO"); raise SystemExit(0)

hallazgos = []
for archivo in resultados:
    for fallo in (archivo.get("failures") or []):
        mensaje = fallo.get("msg", "")
        hallazgos.append({
            "control": mensaje.split(":", 1)[0].strip() or "desconocido",
            "mensaje": mensaje,
            "archivo": archivo.get("filename", ""),
        })
print(json.dumps(hallazgos, ensure_ascii=False))
PY
)"

[[ "$violaciones" != "FALLO" ]] || emitir error "No se pudo interpretar la salida de conftest" "[]" 1

total="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])))' "$violaciones")"

if (( total > 0 )); then
  emitir bloqueado "$total violación(es) de política" "$violaciones" 1
fi

emitir conforme "Todas las políticas se cumplen" "[]" 0
