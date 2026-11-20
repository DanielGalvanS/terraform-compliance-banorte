"""Efectos deterministas a partir de una decisión ya validada.

Aquí vive todo lo que el agente NO puede hacer por sí mismo. En esta fase solo
se presenta la decisión (comentario del PR); el registro en la API, Jira y los
PR de remediación se agregan en las fases siguientes.
"""

from __future__ import annotations

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
