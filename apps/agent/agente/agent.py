"""Definición del agente ADK.

Un solo LlmAgent con cuatro herramientas de solo lectura y salida estructurada.
`adk web` y `adk run` buscan la variable ``root_agent`` en este paquete.

Modelo:
- Local (antes de tener GCP): llave de Google AI Studio en GOOGLE_API_KEY, solo
  con los planes de ejemplo.
- Con GCP: Vertex AI con GOOGLE_GENAI_USE_VERTEXAI=TRUE, GOOGLE_CLOUD_PROJECT y
  GOOGLE_CLOUD_LOCATION, autenticado como la cuenta app-agente.
"""

from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.models.base_llm import BaseLlm
from google.genai import types

from .esquemas import RespuestaModelo
from .herramientas import HERRAMIENTAS
from .instruccion import INSTRUCCION

MODELO_POR_DEFECTO = "gemini-3.5-flash"
CLAVE_SALIDA = "respuesta"


def nombre_modelo() -> str:
    return os.environ.get("MODELO_AGENTE", MODELO_POR_DEFECTO)


def crear_agente(modelo: str | BaseLlm | None = None) -> LlmAgent:
    """Crea el agente. Las pruebas pasan un modelo falso en ``modelo``."""
    return LlmAgent(
        name="agente_cumplimiento",
        description="Explica, clasifica y prioriza violaciones de la compuerta de cumplimiento.",
        model=modelo or nombre_modelo(),
        instruction=INSTRUCCION,
        tools=HERRAMIENTAS,
        output_schema=RespuestaModelo,
        output_key=CLAVE_SALIDA,
        # Temperatura baja: la misma entrada debe dar casi la misma clasificación.
        generate_content_config=types.GenerateContentConfig(temperature=0.1),
    )


root_agent = crear_agente()
