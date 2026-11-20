"""Contratos de datos del agente.

Hay dos familias de modelos y la separación es deliberada:

- ``RespuestaModelo`` / ``ClasificacionModelo``: lo único que Gemini puede
  producir. No incluye el resultado de la compuerta ni la severidad: el modelo
  opina sobre prioridad y explicación, nunca sobre si se bloquea.
- ``Decision`` / ``Clasificacion``: lo que el código arma y registra. Copia el
  veredicto tal cual lo emitió la compuerta y toma la severidad del catálogo.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AccionSugerida = Literal["proponer_pr", "escalar_jira", "ninguna"]
ResultadoCompuerta = Literal["conforme", "bloqueado", "error"]
EstadoDecision = Literal["analizado", "sin_violaciones", "sin_analisis", "error_agente"]
Origen = Literal["Plan", "Drift", "Evento", "Auditoría"]
Ambiente = Literal["Dev", "QA", "Prod"]


class Violacion(BaseModel):
    """Una violación tal como la reporta la compuerta, con un id estable."""

    model_config = ConfigDict(frozen=True)

    id: str
    control: str
    recurso: str | None
    mensaje: str


class ClasificacionModelo(BaseModel):
    """Lo que el modelo concluye de UNA violación."""

    violacion: str = Field(description="Id de la violación, por ejemplo V01. Debe existir en la entrada.")
    prioridad: int = Field(ge=1, le=5, description="1 = atender ya, 5 = puede esperar.")
    explicacion: str = Field(description="2 a 4 frases para quien escribió el cambio: qué pasa y por qué importa.")
    riesgo: str = Field(description="Una frase: qué podría hacer un atacante o qué se incumple.")
    remediacion: str = Field(description="El cambio de Terraform que lo corrige, en palabras.")
    accion_sugerida: AccionSugerida
    confianza: int = Field(ge=0, le=100)
    citas: list[str] = Field(description="Referencias del catálogo usadas, por ejemplo 'CO-NET-01', 'CIS GCP 3.6'.")


class RespuestaModelo(BaseModel):
    """Salida final del agente. ADK la valida contra este esquema."""

    resumen: str = Field(description="Dos o tres frases sobre el conjunto de violaciones.")
    clasificaciones: list[ClasificacionModelo]


class Clasificacion(BaseModel):
    """Clasificación registrada: la violación + datos del catálogo + opinión del modelo."""

    violacion: str
    control: str
    titulo_control: str
    severidad: str
    marcos: list[str]
    recurso: str | None
    mensaje: str
    prioridad: int
    explicacion: str
    riesgo: str
    remediacion: str
    accion_sugerida: AccionSugerida
    confianza: int
    citas: list[str]


class Decision(BaseModel):
    """Registro completo de una ejecución del agente (criterio de DEV-46)."""

    version: Literal["1"] = "1"
    ejecucion_id: str
    fecha: str
    origen: Origen
    ambiente: Ambiente
    commit: str
    resultado_compuerta: ResultadoCompuerta
    motivo_compuerta: str
    estado: EstadoDecision
    resumen: str
    clasificaciones: list[Clasificacion] = []
    herramientas_usadas: list[str] = []
    ajustes: list[str] = Field(
        default=[],
        description="Correcciones que el código hizo a la opinión del modelo, con su motivo.",
    )
    intentos_fallidos: list[str] = Field(
        default=[],
        description="Intentos que fallaron antes del resultado, con el modelo y el motivo.",
    )
    modelo: str | None = Field(default=None, description="Modelo del último intento.")
    version_prompt: str
    hash_entradas: str
    error: str | None = None

    @property
    def fallo(self) -> bool:
        """True cuando el agente no pudo opinar y el pipeline debe bloquear."""
        return self.estado == "error_agente"
