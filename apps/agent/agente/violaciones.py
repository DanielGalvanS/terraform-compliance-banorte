"""Del veredicto de la compuerta a una lista de violaciones con id estable.

``policy_check.sh`` no emite la dirección del recurso como campo propio: va
dentro del mensaje, entre comillas simples, en las 8 políticas
(«CO-NET-01: la regla 'google_compute_firewall.allow_ssh' expone…»).
"""

from __future__ import annotations

import re
from typing import Any

from .esquemas import Violacion

# Una dirección de Terraform: módulos opcionales, tipo.nombre y un índice opcional.
_DIRECCION = re.compile(
    r"'((?:module\.[\w-]+(?:\[[^\]]+\])?\.)*(?:data\.)?[a-z0-9_]+\.[\w-]+(?:\[[^\]]+\])?)'"
)


def extraer_recurso(mensaje: str) -> str | None:
    """Primera dirección de recurso citada en el mensaje, o None."""
    coincidencia = _DIRECCION.search(mensaje)
    return coincidencia.group(1) if coincidencia else None


def desde_veredicto(veredicto: dict[str, Any]) -> list[Violacion]:
    """Numera las violaciones en el orden en que las emitió la compuerta.

    El mismo control puede aparecer dos veces sobre el mismo recurso (por
    ejemplo, el puerto 22 y el 3389 de una regla), así que el id es la
    posición y no la pareja control-recurso.
    """
    return [
        Violacion(
            id=f"V{i:02d}",
            control=str(v.get("control", "desconocido")),
            recurso=extraer_recurso(str(v.get("mensaje", ""))),
            mensaje=str(v.get("mensaje", "")),
        )
        for i, v in enumerate(veredicto.get("violaciones") or [], start=1)
    ]
