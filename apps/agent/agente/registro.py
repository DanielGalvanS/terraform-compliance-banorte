"""Registra la decisión en la API de cumplimiento (POST /api/v1/decisiones).

Lo hace el código después de validar la salida del modelo, no el agente: el
agente no tiene herramientas que escriban (CP-17).

La API recibe los mismos campos que ``decision.json``, en camelCase. Reenviar la
misma ejecución no duplica nada (la API responde 200 con lo ya registrado).
"""

from __future__ import annotations

from typing import Any

import httpx

from .esquemas import Decision

TIEMPO_REGISTRO = 10.0

# Las pruebas lo sustituyen por un httpx.MockTransport.
_TRANSPORTE: httpx.BaseTransport | None = None


def _camel(clave: str) -> str:
    primera, *resto = clave.split("_")
    return primera + "".join(p.capitalize() for p in resto)


def _a_camel(valor: Any) -> Any:
    if isinstance(valor, dict):
        return {_camel(k): _a_camel(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_a_camel(v) for v in valor]
    return valor


def cuerpo(decision: Decision) -> dict[str, Any]:
    """La decisión como la espera la API. Los campos que la API no usa (como
    ``marcos`` o ``severidad``, que toma de su propio catálogo) los ignora."""
    return _a_camel(decision.model_dump(mode="json"))


class FalloRegistro(Exception):
    """La API no aceptó la decisión."""


def registrar(api_url: str, decision: Decision) -> dict[str, Any]:
    """Envía la decisión y devuelve lo que la API registró (con los ids de hallazgo)."""
    url = f"{api_url.rstrip('/')}/api/v1/decisiones"
    try:
        with httpx.Client(timeout=TIEMPO_REGISTRO, transport=_TRANSPORTE) as cliente:
            respuesta = cliente.post(url, json=cuerpo(decision))
    except httpx.HTTPError as error:
        raise FalloRegistro(f"la API no respondió ({type(error).__name__})") from error
    if respuesta.status_code not in (200, 201):
        raise FalloRegistro(f"la API respondió {respuesta.status_code}: {respuesta.text[:200]}")
    return respuesta.json()
