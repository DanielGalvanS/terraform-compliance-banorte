"""Herramientas del agente. TODAS son de solo lectura.

El agente no tiene ninguna herramienta que escriba, apruebe o cambie un
veredicto (CP-17): registrar la decisión, abrir tickets o PR lo hace código
determinista después, a partir de la salida validada (ver ``acciones.py``).

Los datos de la ejecución (plan sanitizado, URL de la API) llegan por el estado
de la sesión, no como argumentos: el modelo no puede pedir un archivo o una URL
arbitraria.
"""

from __future__ import annotations

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


def _consultar_api(tool_context: ToolContext, ruta: str, parametros: dict[str, str]) -> dict[str, Any] | None:
    base = tool_context.state.get(CLAVE_API)
    if not base:
        return None
    try:
        respuesta = httpx.get(f"{base.rstrip('/')}/api/v1{ruta}", params=parametros, timeout=TIEMPO_API)
        respuesta.raise_for_status()
        return respuesta.json()
    except (httpx.HTTPError, ValueError):
        return None


def _coincide(recurso_api: str, recurso: str) -> bool:
    if not recurso:
        return True
    nombre = recurso.rsplit(".", 1)[-1]
    return recurso in recurso_api or nombre in recurso_api


def buscar_hallazgos(control: str, recurso: str, tool_context: ToolContext) -> dict[str, Any]:
    """Busca hallazgos previos del mismo control sobre el mismo recurso.

    Sirve para saber si el problema es nuevo o recurrente, y si alguien ya lo
    está remediando.

    Args:
        control: Código del control, por ejemplo "CO-DB-01".
        recurso: Dirección de Terraform del recurso.
    """
    datos = _consultar_api(tool_context, "/hallazgos", {"control": control})
    if datos is None:
        return {"disponible": False, "motivo": "API de cumplimiento no disponible"}
    previos = [
        {"estado": h.get("estado"), "ambiente": h.get("ambiente"), "detectadoEn": h.get("detectadoEn")}
        for h in datos.get("hallazgos", [])
        if _coincide(str(h.get("recurso", "")), recurso)
    ]
    return {"disponible": True, "previos": previos}


def buscar_excepciones(control: str, recurso: str, tool_context: ToolContext) -> dict[str, Any]:
    """Busca excepciones registradas para el control y el recurso.

    Una excepción activa no cambia el veredicto de la compuerta; solo da
    contexto para priorizar y explicar.

    Args:
        control: Código del control, por ejemplo "CO-NET-01".
        recurso: Dirección de Terraform del recurso.
    """
    datos = _consultar_api(tool_context, "/excepciones", {"control": control})
    if datos is None:
        return {"disponible": False, "motivo": "API de cumplimiento no disponible"}
    excepciones = [
        {"id": e.get("id"), "estado": e.get("estado"), "venceEl": e.get("venceEl")}
        for e in datos.get("excepciones", [])
        if _coincide(str(e.get("recurso", "")), recurso)
    ]
    return {"disponible": True, "excepciones": excepciones}


HERRAMIENTAS = [consultar_control, consultar_recurso, buscar_hallazgos, buscar_excepciones]
