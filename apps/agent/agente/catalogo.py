"""Lectura del catálogo de controles (infra/policies/mappings.yaml).

Es la misma fuente de verdad que usan la compuerta y la API: el agente no
mantiene una copia propia de los controles.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

RAIZ_REPO = Path(__file__).resolve().parents[3]
RUTA_POR_DEFECTO = RAIZ_REPO / "infra" / "policies" / "mappings.yaml"

# El YAML guarda la severidad sin acento; la API y el dashboard la muestran así.
SEVERIDADES = {"critica": "Crítica", "alta": "Alta", "media": "Media", "baja": "Baja"}


@dataclass(frozen=True)
class Referencia:
    marco: str
    referencia: str
    titulo: str
    por_validar: bool

    @property
    def cita(self) -> str:
        return f"{self.marco} {self.referencia}"


@dataclass(frozen=True)
class Control:
    codigo: str
    titulo: str
    descripcion: str
    severidad: str
    referencias: tuple[Referencia, ...]

    @property
    def marcos(self) -> list[str]:
        return [r.cita for r in self.referencias]


@dataclass(frozen=True)
class Catalogo:
    version: str
    controles: dict[str, Control]

    def control(self, codigo: str) -> Control | None:
        return self.controles.get(codigo.strip().upper())


def cargar(ruta: str | os.PathLike[str] | None = None) -> Catalogo:
    ruta = Path(ruta or os.environ.get("RUTA_CATALOGO") or RUTA_POR_DEFECTO)
    datos = yaml.safe_load(ruta.read_text(encoding="utf-8"))

    marcos = {clave: m.get("nombre_corto", clave) for clave, m in (datos.get("marcos") or {}).items()}

    controles: dict[str, Control] = {}
    for c in datos.get("controles") or []:
        referencias = tuple(
            Referencia(
                marco=marcos.get(clave_marco, clave_marco),
                referencia=str(ref["referencia"]),
                titulo=ref.get("titulo", ""),
                por_validar=bool(ref.get("por_validar", False)),
            )
            for clave_marco, refs in (c.get("mapeo") or {}).items()
            for ref in refs
        )
        controles[c["id"]] = Control(
            codigo=c["id"],
            titulo=c["titulo"],
            descripcion=" ".join(str(c.get("descripcion", "")).split()),
            severidad=SEVERIDADES.get(c["severidad"], c["severidad"]),
            referencias=referencias,
        )

    return Catalogo(version=str(datos.get("version_catalogo", "?")), controles=controles)


@lru_cache(maxsize=1)
def por_defecto() -> Catalogo:
    return cargar()
