"""Herramientas del agente. TODAS son de solo lectura.

El agente no tiene ninguna herramienta que escriba, apruebe o cambie un
veredicto (CP-17): registrar la decisión, abrir tickets o PR lo hace código
determinista después, a partir de la salida validada (ver ``acciones.py``).

Los datos de la ejecución (plan sanitizado, URL de la API) llegan por el estado
de la sesión, no como argumentos: el modelo no puede pedir un archivo o una URL
arbitraria.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from google.adk.tools.tool_context import ToolContext

from . import catalogo

CLAVE_RECURSOS = "recursos"
CLAVE_API = "api_url"
TIEMPO_API = 5.0


def consultar_control(codigo: str) -> dict[str, Any]:
    """Consulta un control del catálogo de cumplimiento.

    Úsala antes de explicar una violación, para citar el control y sus
    referencias en los marcos (CIS GCP, NIST 800-53, SOC 2, LFPDPPP).

    Args:
        codigo: Código del control, por ejemplo "CO-NET-01".

    Returns:
        Título, descripción, severidad y referencias por marco. Las referencias
        con por_validar=true aún no las confirma Cumplimiento.
    """
    control = catalogo.por_defecto().control(codigo)
    if control is None:
        return {"encontrado": False, "codigo": codigo}
    return {
        "encontrado": True,
        "codigo": control.codigo,
        "titulo": control.titulo,
        "descripcion": control.descripcion,
        "severidad": control.severidad,
        "referencias": [
            {"marco": r.marco, "referencia": r.referencia, "titulo": r.titulo, "por_validar": r.por_validar}
            for r in control.referencias
        ],
    }


def consultar_recurso(direccion: str, tool_context: ToolContext) -> dict[str, Any]:
    """Consulta la configuración de un recurso del plan evaluado.

    Devuelve solo metadatos de configuración (puertos, rangos de origen, si
    tiene IP pública, nombres de etiquetas, rol de IAM). Nunca devuelve valores
    de secretos ni datos de personas.

    Args:
        direccion: Dirección de Terraform, por ejemplo
            "google_compute_firewall.allow_ssh".
    """
    recursos: dict[str, Any] = tool_context.state.get(CLAVE_RECURSOS) or {}
    vista = recursos.get(direccion)
    if vista is None:
        return {"encontrado": False, "direccion": direccion}
    return {"encontrado": True, **vista}


# Las pruebas lo sustituyen por un httpx.MockTransport para no depender de la red.
_TRANSPORTE: httpx.AsyncBaseTransport | None = None


def cabeceras_api() -> dict[str, str]:
    """Token del agente para la API, si lo hay.

    Se lee del entorno en cada llamada y nunca pasa por el estado de la sesión:
    el modelo no debe ver el token, ni poder pedir que se use con otra URL.
    En desarrollo se emite con ``npm run token -- --rol Agente``; en GCP saldrá
    de la cuenta de servicio ``app-agente``.
    """
    token = os.environ.get("API_TOKEN")
    return {"authorization": f"Bearer {token}"} if token else {}


async def consultar_api(base: str | None, ruta: str, parametros: dict[str, str]) -> dict[str, Any] | None:
    """GET a la API de cumplimiento. None si no hay API o no responde.

    Es asíncrona a propósito: ADK corre las herramientas síncronas en el mismo
    hilo que el agente, y una API lenta lo congelaría sin que el límite de
    tiempo de ``ejecutar`` pudiera cortarlo.
    """
    if not base:
        return None
    try:
        async with httpx.AsyncClient(timeout=TIEMPO_API, transport=_TRANSPORTE) as cliente:
            respuesta = await cliente.get(
                f"{base.rstrip('/')}/api/v1{ruta}", params=parametros, headers=cabeceras_api()
            )
            respuesta.raise_for_status()
            return respuesta.json()
    except (httpx.HTTPError, ValueError):
        return None


def filtro(control: str, recurso: str | None) -> dict[str, str]:
    """Parámetros de búsqueda. La API filtra por recurso con la dirección
    completa del plan; ``coincide`` se queda como segunda comprobación."""
    return {"control": control, **({"recurso": recurso} if recurso else {})}


def coincide(recurso_api: str, recurso: str | None) -> bool:
    if not recurso:
        return True
    nombre = recurso.rsplit(".", 1)[-1]
    return recurso in recurso_api or nombre in recurso_api


async def buscar_hallazgos(control: str, recurso: str, tool_context: ToolContext) -> dict[str, Any]:
    """Busca hallazgos previos del mismo control sobre el mismo recurso.

    Sirve para saber si el problema es nuevo o recurrente, y si alguien ya lo
    está remediando.

    Args:
        control: Código del control, por ejemplo "CO-DB-01".
        recurso: Dirección de Terraform del recurso.
    """
    datos = await consultar_api(tool_context.state.get(CLAVE_API), "/hallazgos", filtro(control, recurso))
    if datos is None:
        return {"disponible": False, "motivo": "API de cumplimiento no disponible"}
    previos = [
        {"estado": h.get("estado"), "ambiente": h.get("ambiente"), "detectadoEn": h.get("detectadoEn")}
        for h in datos.get("hallazgos", [])
        if coincide(str(h.get("recurso", "")), recurso)
    ]
    return {"disponible": True, "previos": previos}


async def buscar_excepciones(control: str, recurso: str, tool_context: ToolContext) -> dict[str, Any]:
    """Busca excepciones registradas para el control y el recurso.

    Una excepción activa no cambia el veredicto de la compuerta; solo da
    contexto para priorizar y explicar.

    Args:
        control: Código del control, por ejemplo "CO-NET-01".
        recurso: Dirección de Terraform del recurso.
    """
    datos = await consultar_api(tool_context.state.get(CLAVE_API), "/excepciones", filtro(control, recurso))
    if datos is None:
        return {"disponible": False, "motivo": "API de cumplimiento no disponible"}
    excepciones = [
        {"id": e.get("id"), "estado": e.get("estado"), "venceEl": e.get("venceEl")}
        for e in datos.get("excepciones", [])
        if coincide(str(e.get("recurso", "")), recurso)
    ]
    return {"disponible": True, "excepciones": excepciones}


async def hay_excepcion_activa(api_url: str | None, control: str, recurso: str | None) -> bool:
    """Lo usa el código (no el modelo) para confirmar una acción 'ninguna'."""
    datos = await consultar_api(api_url, "/excepciones", {**filtro(control, recurso), "estado": "Activa"})
    if datos is None:
        return False
    return any(
        e.get("estado") == "Activa" and coincide(str(e.get("recurso", "")), recurso)
        for e in datos.get("excepciones", [])
    )


HERRAMIENTAS = [consultar_control, consultar_recurso, buscar_hallazgos, buscar_excepciones]
