#!/usr/bin/env python3
"""Comprueba que el frontend y el catálogo de controles dicen lo mismo.

El catálogo (`infra/policies/mappings.yaml`) decide qué marcos están en alcance
y qué controles existen. Las pantallas muestran ambas cosas. Cuando se separan,
el producto enseña una cobertura que las políticas no respaldan, y eso no se
nota mirando el código: hay que cruzarlo.

Comprueba cuatro cosas:

1. Los marcos del frontend son exactamente los del catálogo.
2. Todo marco que aparece en un dato de ejemplo está en alcance.
3. Todo control `CO-XX-NN` que muestra el frontend existe en el catálogo.
4. Las etiquetas obligatorias dicen lo mismo en los cuatro sitios donde viven:
   el catálogo, la política CO-TAG-01, los módulos de Terraform y el frontend.

Uso:

    python3 scripts/verificar_catalogo.py

Sale con código distinto de cero si algo no cuadra, para que el pipeline falle.
"""

from __future__ import annotations

import json
import pathlib
import re
import shutil
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "infra" / "policies" / "mappings.yaml"
POLITICA_ETIQUETAS = RAIZ / "infra" / "policies" / "rego" / "co_tag_01.rego"
FRONTEND = RAIZ / "apps" / "web" / "src"
MARCOS_FRONTEND = FRONTEND / "shared" / "model" / "frameworks.ts"
ETIQUETAS_FRONTEND = FRONTEND / "features" / "inventory" / "model" / "types.ts"
MODULO_TERRAFORM = RAIZ / "infra" / "modules" / "kms" / "variables.tf"

problemas: list[str] = []


def fallo(mensaje: str) -> None:
    problemas.append(mensaje)
    print(f"  ✗ {mensaje}")


def bien(mensaje: str) -> None:
    print(f"  ✓ {mensaje}")


def leer_catalogo() -> dict:
    """El YAML se lee con conftest, que ya es una dependencia del pipeline."""
    if shutil.which("conftest") is None:
        print("conftest no está instalado y hace falta para leer el catálogo.", file=sys.stderr)
        raise SystemExit(2)
    salida = subprocess.run(
        ["conftest", "parse", str(CATALOGO)],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(salida)


def cadenas_de(texto: str, patron: str) -> set[str]:
    return set(re.findall(patron, texto))


def main() -> int:
    catalogo = leer_catalogo()
    marcos_catalogo = {m["nombre_corto"] for m in catalogo["marcos"].values()}
    controles_catalogo = {c["id"] for c in catalogo["controles"]}

    print("1. Marcos declarados en el frontend")
    texto = MARCOS_FRONTEND.read_text(encoding="utf-8")
    bloque = re.search(r"FRAMEWORKS_IN_SCOPE = \[(.*?)\]", texto, re.S)
    marcos_frontend = cadenas_de(bloque.group(1), r"'([^']+)'") if bloque else set()

    if marcos_frontend == marcos_catalogo:
        bien(f"los {len(marcos_frontend)} marcos coinciden con el catálogo")
    else:
        if sobran := marcos_frontend - marcos_catalogo:
            fallo(f"el frontend muestra marcos que no están en el catálogo: {', '.join(sorted(sobran))}")
        if faltan := marcos_catalogo - marcos_frontend:
            fallo(f"el frontend no muestra marcos del catálogo: {', '.join(sorted(faltan))}")

    print("\n2. Marcos usados en los datos de ejemplo")
    for archivo in sorted(FRONTEND.glob("features/*/data/*.ts")):
        contenido = archivo.read_text(encoding="utf-8")
        usados = cadenas_de(contenido, r"framework: '([^']+)'")
        for lista in re.findall(r"frameworks: \[([^\]]*)\]", contenido):
            usados |= cadenas_de(lista, r"'([^']+)'")
        if not usados:
            continue
        if fuera := usados - marcos_frontend:
            fallo(f"{archivo.relative_to(RAIZ)} usa marcos fuera de alcance: {', '.join(sorted(fuera))}")
        else:
            bien(f"{archivo.relative_to(RAIZ)}")

    print("\n3. Controles citados por el frontend")
    citados: set[str] = set()
    for archivo in sorted(FRONTEND.rglob("*.ts")):
        citados |= cadenas_de(archivo.read_text(encoding="utf-8"), r"'(CO-[A-Z]+-\d+)'")
    if inexistentes := citados - controles_catalogo:
        fallo(f"el frontend cita controles que no existen: {', '.join(sorted(inexistentes))}")
    else:
        bien(f"los {len(citados)} controles citados existen en el catálogo")

    print("\n4. Etiquetas obligatorias")

    def entre(texto: str, patron: str, comillas: str) -> set[str]:
        bloque = re.search(patron, texto, re.S)
        return cadenas_de(bloque.group(1), comillas) if bloque else set()

    fuentes = {
        "catálogo": set(catalogo["etiquetas_obligatorias"]),
        "CO-TAG-01": entre(
            POLITICA_ETIQUETAS.read_text(encoding="utf-8"),
            r"etiquetas_obligatorias := \{(.*?)\}",
            r'"([^"]+)"',
        ),
        "Terraform": entre(
            MODULO_TERRAFORM.read_text(encoding="utf-8"),
            r"setsubtract\(\s*\[(.*?)\]",
            r'"([^"]+)"',
        ),
        "frontend": entre(
            ETIQUETAS_FRONTEND.read_text(encoding="utf-8"),
            r"MANDATORY_TAG_KEYS = \[(.*?)\]",
            r"'([^']+)'",
        ),
    }

    referencia = fuentes["catálogo"]
    discrepan = {n: v for n, v in fuentes.items() if v != referencia}
    if not discrepan:
        bien(f"las {len(referencia)} claves coinciden en los cuatro sitios")
    else:
        for nombre, valores in discrepan.items():
            fallo(
                f"{nombre} no coincide con el catálogo: "
                f"sobran={sorted(valores - referencia)} faltan={sorted(referencia - valores)}"
            )

    print()
    if problemas:
        print(f"{len(problemas)} desalineación(es) entre el frontend y el catálogo.")
        return 1
    print("El frontend y el catálogo de controles están alineados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
