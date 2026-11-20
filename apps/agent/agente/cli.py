"""Línea de comandos del agente.

    python -m agente analizar --veredicto veredicto.json --plan plan.json \\
        --ambiente Dev --origen Plan --salida decision.json --comentario comentario.md

Códigos de salida:
    0  el agente terminó (aunque la compuerta haya bloqueado: eso lo decide ella)
    1  el agente falló; el pipeline debe bloquear y notificar (regla segura)
    2  la entrada no se pudo leer; también bloquea
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from . import acciones
from .ejecutar import TIEMPO_LIMITE, analizar


def _leer_json(ruta: str) -> dict:
    return json.loads(Path(ruta).read_text(encoding="utf-8"))


def _argumentos(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="agente", description="Agente de cumplimiento (Google ADK).")
    sub = parser.add_subparsers(dest="comando", required=True)
    a = sub.add_parser("analizar", help="Clasifica y explica las violaciones de un veredicto.")
    a.add_argument("--veredicto", required=True, help="veredicto.json de policy_check.sh")
    a.add_argument("--plan", help="plan.json (terraform show -json); opcional")
    a.add_argument("--ambiente", default="Dev", choices=["Dev", "QA", "Prod"])
    a.add_argument("--origen", default="Plan", choices=["Plan", "Drift", "Evento", "Auditoría"])
    a.add_argument("--salida", default="decision.json")
    a.add_argument("--comentario", help="Archivo Markdown para el comentario del PR")
    a.add_argument("--api-url", default=os.environ.get("API_URL"))
    a.add_argument("--tiempo-limite", type=float, default=TIEMPO_LIMITE)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _argumentos(argv)

    try:
        veredicto = _leer_json(args.veredicto)
        plan = _leer_json(args.plan) if args.plan else None
    except (OSError, ValueError) as error:
        print(f"agente: no se pudo leer la entrada ({error}); se bloquea por regla segura", file=sys.stderr)
        return 2

    decision = analizar(
        veredicto,
        plan,
        ambiente=args.ambiente,
        origen=args.origen,
        api_url=args.api_url,
        tiempo_limite=args.tiempo_limite,
    )

    Path(args.salida).write_text(decision.model_dump_json(indent=2), encoding="utf-8")
    if args.comentario:
        Path(args.comentario).write_text(acciones.comentario(decision), encoding="utf-8")

    print(
        f"agente: {decision.estado} · compuerta {decision.resultado_compuerta} · "
        f"{len(decision.clasificaciones)} clasificación(es) -> {args.salida}",
        file=sys.stderr,
    )
    if decision.fallo:
        print(f"agente no disponible: se bloquea por regla segura ({decision.error})", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
