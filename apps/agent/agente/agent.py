"""Definición del agente ADK.

Un solo LlmAgent con cuatro herramientas de solo lectura y salida estructurada.
`adk web` y `adk run` buscan la variable ``root_agent`` en este paquete.

Modelo:
- Local (antes de tener GCP): llave de Google AI Studio en GOOGLE_API_KEY, solo
  con los planes de ejemplo.
- Con GCP: Vertex AI con GOOGLE_GENAI_USE_VERTEXAI=TRUE, GOOGLE_CLOUD_PROJECT y
  GOOGLE_CLOUD_LOCATION (global: los Gemini 3.x no están en us-central1),
  autenticado como la cuenta app-agente. Requiere una cuenta de facturación
  de pago; en la prueba gratuita de GCP Vertex responde 403.
"""

from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.models.base_llm import BaseLlm
from google.adk.models.google_llm import Gemini
from google.genai import types

from .esquemas import RespuestaModelo
from .herramientas import HERRAMIENTAS
from .instruccion import INSTRUCCION

MODELO_POR_DEFECTO = "gemini-3.5-flash"
# Si el principal está saturado (pasa seguido con la capa gratuita), el segundo
# intento usa este. MODELO_RESPALDO="" lo desactiva.
RESPALDO_POR_DEFECTO = "gemini-3.5-flash-lite"
CLAVE_SALIDA = "respuesta"

# Cada llamada a Gemini tiene su propio límite y pocos reintentos. Sin esto, la
# librería reintenta un 503 con esperas cada vez más largas y se come todo el
# tiempo del intento sin decir por qué.
TIEMPO_LLAMADA_MS = 60_000
REINTENTOS_LLAMADA = types.HttpRetryOptions(attempts=2, initial_delay=1, max_delay=4)


def nombre_modelo() -> str:
    return os.environ.get("MODELO_AGENTE", MODELO_POR_DEFECTO)


def nombre_respaldo() -> str | None:
    return os.environ.get("MODELO_RESPALDO", RESPALDO_POR_DEFECTO).strip() or None


def _modelo(modelo: str | BaseLlm | None) -> BaseLlm:
    if isinstance(modelo, BaseLlm):
        return modelo
    return Gemini(model=modelo or nombre_modelo(), retry_options=REINTENTOS_LLAMADA)


def crear_agente(modelo: str | BaseLlm | None = None) -> LlmAgent:
    """Crea el agente. Las pruebas pasan un modelo falso en ``modelo``."""
    return LlmAgent(
        name="agente_cumplimiento",
        description="Explica, clasifica y prioriza violaciones de la compuerta de cumplimiento.",
        model=_modelo(modelo),
        instruction=INSTRUCCION,
        tools=HERRAMIENTAS,
        output_schema=RespuestaModelo,
        output_key=CLAVE_SALIDA,
        generate_content_config=types.GenerateContentConfig(
            # Temperatura baja: la misma entrada debe dar casi la misma clasificación.
            temperature=0.1,
            http_options=types.HttpOptions(timeout=TIEMPO_LLAMADA_MS),
        ),
    )


root_agent = crear_agente()
