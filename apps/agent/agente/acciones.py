"""Efectos deterministas a partir de una decisión ya validada.

Aquí vive todo lo que el agente NO puede hacer por sí mismo: presentar la
decisión (comentario del PR) y registrarla en la API. Jira y los PR de
remediación se agregan en las fases siguientes.
"""

from __future__ import annotations

from typing import Any

import httpx

from . import herramientas
from .esquemas import Decision

_ACCIONES = {"proponer_pr": "Proponer PR", "escalar_jira": "Escalar a Jira", "ninguna": "Ninguna"}


def _celda(texto: str) -> str:
    """Texto del modelo, seguro para un comentario de GitHub.

    El modelo escribe parte de este texto, y lo que lee viene de un plan que
    cualquiera puede editar en su PR. Por eso se neutraliza lo que GitHub
    interpretaría: menciones (@persona notifica a gente real), HTML, imágenes y
    enlaces, y las barras que romperían la tabla.
    """
    texto = " ".join(str(texto).split())
    for original, seguro in (
        ("\\", "\\\\"),
        ("|", "\\|"),
        ("<", "&lt;"),
        (">", "&gt;"),
        ("[", "\\["),
        ("]", "\\]"),
        ("`", "\\`"),
        ("@", "@​"),  # espacio de ancho cero: se lee igual, pero no menciona
    ):
        texto = texto.replace(original, seguro)
    return texto


def comentario(decision: Decision) -> str:
    """Markdown para el comentario del PR. El veredicto se repite tal cual."""
    lineas = [
        "### Agente de cumplimiento",
        "",
        f"Veredicto de la compuerta: **{decision.resultado_compuerta}**. "
        "El agente explica y prioriza; no cambia el veredicto.",
        "",
    ]

    if decision.estado == "error_agente":
        lineas += [
            "> **Agente no disponible: se bloquea por regla segura.**",
            f"> Motivo: {_celda(decision.error or 'desconocido')}",
        ]
        return "\n".join(lineas) + "\n"

    lineas += [_celda(decision.resumen), ""]
    if not decision.clasificaciones:
        return "\n".join(lineas) + "\n"

    lineas += [
        "| Prioridad | Control | Severidad | Recurso | Acción sugerida |",
        "|---|---|---|---|---|",
    ]
    for c in sorted(decision.clasificaciones, key=lambda c: (c.prioridad, c.violacion)):
        lineas.append(
            f"| {c.prioridad} | {c.control} | {c.severidad} | `{(c.recurso or '—').replace('`', '')}` | {_ACCIONES[c.accion_sugerida]} |"
        )

    lineas += ["", "<details><summary>Explicación por violación</summary>", ""]
    for c in sorted(decision.clasificaciones, key=lambda c: (c.prioridad, c.violacion)):
        lineas += [
            f"**{c.violacion} · {c.control} · {_celda(c.titulo_control)}**",
            "",
            f"- Qué pasa: {_celda(c.explicacion)}",
            f"- Riesgo: {_celda(c.riesgo)}",
            f"- Cómo corregirlo: {_celda(c.remediacion)}",
            f"- Marcos: {', '.join(c.marcos) or '—'} · confianza {c.confianza}/100",
            "",
        ]
    lineas += ["</details>", ""]
    if decision.ajustes:
        lineas += ["**Ajustes que hizo el código a la opinión del modelo:**", ""]
        lineas += [f"- {_celda(a)}" for a in decision.ajustes]
        lineas += [""]
    if decision.intentos_fallidos:
        lineas += [
            f"Respondió el modelo de respaldo; antes falló: {_celda('; '.join(decision.intentos_fallidos))}.",
            "",
        ]
    lineas += [
        f"<sub>Modelo {decision.modelo} · prompt {decision.version_prompt} · "
        f"herramientas usadas: {len(decision.herramientas_usadas)} · ejecución {decision.ejecucion_id}</sub>",
    ]
    return "\n".join(lineas) + "\n"


def para_api(decision: Decision) -> dict[str, Any]:
    """La decisión en el formato de ``POST /api/v1/decisiones``.

    Es un subconjunto: el ``decision.json`` completo queda como artefacto del
    pipeline y ``hashEntradas`` liga los dos. Solo se manda lo que la API
    guarda; lo demás no tiene por qué salir del pipeline.
    """
    return {
        "ejecucionId": decision.ejecucion_id,
        "fecha": decision.fecha,
        "origen": decision.origen,
        "ambiente": decision.ambiente,
        "commit": decision.commit,
        "resultadoCompuerta": decision.resultado_compuerta,
        "estado": decision.estado,
        "resumen": decision.resumen,
        "clasificaciones": [
            {
                "violacion": c.violacion,
                "control": c.control,
                "recurso": c.recurso,
                "severidad": c.severidad,
                "prioridad": c.prioridad,
                "accionSugerida": c.accion_sugerida,
                "confianza": c.confianza,
                "explicacion": c.explicacion,
                "remediacion": c.remediacion,
            }
            for c in decision.clasificaciones
        ],
        "herramientasUsadas": decision.herramientas_usadas,
        "ajustes": decision.ajustes,
        "modelo": decision.modelo,
        "versionPrompt": decision.version_prompt,
        "hashEntradas": decision.hash_entradas,
        "error": decision.error,
    }


async def registrar_en_api(decision: Decision, api_url: str) -> str | None:
    """Registra la decisión en la API. Devuelve None si quedó registrada, o el motivo.

    La API es idempotente por ``ejecucionId``: si un reintento llega después
    de que el primero sí entró, responde 200 y no duplica nada.
    """
    try:
        async with httpx.AsyncClient(timeout=herramientas.TIEMPO_API, transport=herramientas._TRANSPORTE) as cliente:
            respuesta = await cliente.post(
                f"{api_url.rstrip('/')}/api/v1/decisiones",
                json=para_api(decision),
                headers=herramientas.cabeceras_api(),
            )
    except httpx.HTTPError as error:
        return f"no se pudo contactar con la API ({type(error).__name__})"
    cuerpo = _json_o_none(respuesta)
    if respuesta.status_code in (200, 201):
        # Un 200 no basta: un proxy o balanceador puede responder 200 con una
        # página HTML sin que la decisión haya llegado a la API. Solo cuenta
        # como registrada si la respuesta es esta misma decisión.
        if (
            isinstance(cuerpo, dict)
            and cuerpo.get("ejecucionId") == decision.ejecucion_id
            and cuerpo.get("hashEntradas") == decision.hash_entradas
        ):
            return None
        return f"la API respondió {respuesta.status_code}, pero no con la decisión enviada"
    detalle = str(cuerpo.get("error", "")) if isinstance(cuerpo, dict) else ""
    return f"la API respondió {respuesta.status_code}" + (f": {detalle}" if detalle else "")


def _json_o_none(respuesta: httpx.Response) -> Any:
    """El cuerpo como JSON, o None si no lo es (HTML de un proxy, vacío…)."""
    try:
        return respuesta.json()
    except ValueError:
        return None
