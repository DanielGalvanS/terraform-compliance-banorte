"""Utilidades de prueba: datos de ejemplo y un modelo falso.

Ninguna prueba llama a Gemini. ``ModeloFalso`` es un ``BaseLlm`` con guion: en
el primer turno pide herramientas y en el segundo entrega la respuesta final,
así se ejercita el ciclo completo de ADK (herramientas, estado, esquema) sin red.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, AsyncGenerator, Callable

import pytest
from google.adk.models._capabilities import LlmCapabilities
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types

DATOS = Path(__file__).parent / "datos"
RAIZ = Path(__file__).resolve().parents[3]
FIXTURES = RAIZ / "infra" / "policies" / "fixtures"


def leer(ruta: Path) -> dict[str, Any]:
    return json.loads(ruta.read_text(encoding="utf-8"))


@pytest.fixture
def veredicto_violaciones() -> dict[str, Any]:
    return leer(DATOS / "veredicto_violaciones.json")


@pytest.fixture
def veredicto_conforme() -> dict[str, Any]:
    return leer(DATOS / "veredicto_conforme.json")


@pytest.fixture
def plan_violaciones() -> dict[str, Any]:
    return leer(FIXTURES / "plan_violaciones.json")


def ids_de_entrada(llm_request: LlmRequest) -> list[str]:
    """Ids de violación que el agente recibió en el mensaje del usuario."""
    for contenido in llm_request.contents:
        if contenido.role == "user":
            for parte in contenido.parts or []:
                if parte.text and parte.text.lstrip().startswith("{"):
                    return [v["id"] for v in json.loads(parte.text)["violaciones"]]
    return []


def clasificacion(id_: str, **cambios: Any) -> dict[str, Any]:
    base = {
        "violacion": id_,
        "prioridad": 2,
        "explicacion": "La regla deja expuesto el recurso.",
        "riesgo": "Acceso no autorizado.",
        "remediacion": "Acotar el rango de origen.",
        "accion_sugerida": "proponer_pr",
        "confianza": 80,
        "citas": ["CO-NET-01"],
    }
    base.update(cambios)
    return base


def respuesta_completa(ids: list[str]) -> dict[str, Any]:
    return {"resumen": "Resumen de prueba.", "clasificaciones": [clasificacion(i) for i in ids]}


class ModeloFalso(BaseLlm):
    """Modelo con guion. ``final`` arma la respuesta final a partir de los ids recibidos."""

    model: str = "modelo-falso"
    final: Callable[[list[str]], Any] = respuesta_completa
    error: str | None = None
    pedir_herramientas: bool = True
    peticiones: list[str] = []
    turnos: int = 0

    @property
    def capabilities(self) -> LlmCapabilities:
        return LlmCapabilities(output_schema_and_tools=True)

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        self.turnos += 1
        # Todo lo que "vería" el modelo, para las pruebas de privacidad.
        self.peticiones.append(
            json.dumps(
                [c.model_dump(mode="json", exclude_none=True) for c in llm_request.contents],
                ensure_ascii=False,
            )
        )
        if self.error:
            raise RuntimeError(self.error)

        ultimo = llm_request.contents[-1]
        vino_de_herramienta = any(p.function_response for p in (ultimo.parts or []))
        if self.pedir_herramientas and not vino_de_herramienta:
            llamadas = [
                types.Part(function_call=types.FunctionCall(name="consultar_control", args={"codigo": "CO-SEC-01"})),
                types.Part(
                    function_call=types.FunctionCall(
                        name="consultar_recurso", args={"direccion": "google_sql_user.app"}
                    )
                ),
            ]
            yield LlmResponse(content=types.Content(role="model", parts=llamadas))
            return

        cuerpo = self.final(ids_de_entrada(llm_request))
        texto = cuerpo if isinstance(cuerpo, str) else json.dumps(cuerpo, ensure_ascii=False)
        yield LlmResponse(content=types.Content(role="model", parts=[types.Part(text=texto)]))


@pytest.fixture
def modelo() -> ModeloFalso:
    return ModeloFalso(peticiones=[])


def con_secreto(plan: dict[str, Any], valor: str) -> dict[str, Any]:
    """Copia del plan con un valor sensible plantado, como si Terraform no lo hubiera ocultado."""
    plan = copy.deepcopy(plan)
    for cambio in plan["resource_changes"]:
        if cambio["address"] == "google_sql_user.app":
            cambio["change"]["after"]["password"] = valor
        if cambio["address"] == "google_secret_manager_secret.sin_etiquetas":
            cambio["change"]["after"]["labels"] = {"duenio": valor}
    return plan
