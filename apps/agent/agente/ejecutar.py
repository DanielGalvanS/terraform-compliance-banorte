"""Corre el agente sobre un veredicto e impone las reglas que no dependen del prompt.

Invariantes (las pruebas las comprueban con un modelo falso):
- ``resultado_compuerta`` se copia del veredicto. El modelo no lo produce.
- La severidad y los marcos vienen del catálogo, no del modelo.
- Cada violación tiene exactamente una clasificación; si falta o sobra alguna,
  la ejecución es un fallo.
- Cualquier fallo (modelo, esquema, tiempo) termina en ``error_agente``, que el
  pipeline trata como bloqueo (regla segura de DEV-46).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from google.adk.models.base_llm import BaseLlm
from google.adk.runners import InMemoryRunner
from google.genai import types
from pydantic import ValidationError

from . import catalogo as catalogo_mod
from . import sanitizar
from .agent import CLAVE_SALIDA, crear_agente, nombre_modelo
from .esquemas import Clasificacion, Decision, RespuestaModelo, Violacion
from .herramientas import CLAVE_API, CLAVE_RECURSOS
from .instruccion import VERSION_PROMPT
from .violaciones import desde_veredicto

APP = "compliance-ops"
USUARIO = "pipeline"
TIEMPO_LIMITE = 120.0
INTENTOS = 2
RESULTADOS_VALIDOS = {"conforme", "bloqueado", "error"}


class FalloAgente(Exception):
    """El agente no produjo una clasificación válida."""


def _hash(*objetos: Any) -> str:
    canonico = json.dumps(objetos, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(canonico.encode("utf-8")).hexdigest()


def mensaje_para_modelo(violaciones: list[Violacion], ambiente: str, origen: str) -> str:
    """Lo único que el agente recibe como entrada. Sin el plan: lo consulta con herramientas."""
    return json.dumps(
        {
            "ambiente": ambiente,
            "origen": origen,
            "violaciones": [v.model_dump() for v in violaciones],
        },
        ensure_ascii=False,
        indent=2,
    )


async def _una_corrida(
    modelo: str | BaseLlm, mensaje: str, estado: dict[str, Any]
) -> tuple[RespuestaModelo, list[str]]:
    runner = InMemoryRunner(agent=crear_agente(modelo), app_name=APP)
    sesion = await runner.session_service.create_session(app_name=APP, user_id=USUARIO, state=estado)

    herramientas: list[str] = []
    texto_final = ""
    async for evento in runner.run_async(
        user_id=USUARIO,
        session_id=sesion.id,
        new_message=types.Content(role="user", parts=[types.Part(text=mensaje)]),
    ):
        herramientas.extend(llamada.name for llamada in evento.get_function_calls())
        if evento.is_final_response() and evento.content and evento.content.parts:
            texto_final = "".join(p.text or "" for p in evento.content.parts if not p.thought)

    sesion = await runner.session_service.get_session(app_name=APP, user_id=USUARIO, session_id=sesion.id)
    salida = sesion.state.get(CLAVE_SALIDA) if sesion else None
    try:
        if isinstance(salida, dict):
            return RespuestaModelo.model_validate(salida), herramientas
        return RespuestaModelo.model_validate_json(texto_final), herramientas
    except ValidationError as error:
        raise FalloAgente(f"la respuesta no cumple el esquema: {error.error_count()} error(es)") from error


def _verificar_cobertura(respuesta: RespuestaModelo, violaciones: list[Violacion]) -> None:
    esperadas = {v.id for v in violaciones}
    recibidas = [c.violacion for c in respuesta.clasificaciones]
    faltan = esperadas - set(recibidas)
    sobran = set(recibidas) - esperadas
    repetidas = {r for r in recibidas if recibidas.count(r) > 1}
    if faltan or sobran or repetidas:
        partes = []
        if faltan:
            partes.append(f"faltan {sorted(faltan)}")
        if sobran:
            partes.append(f"inventadas {sorted(sobran)}")
        if repetidas:
            partes.append(f"repetidas {sorted(repetidas)}")
        raise FalloAgente("clasificaciones incompletas: " + "; ".join(partes))


def _armar_clasificaciones(
    respuesta: RespuestaModelo, violaciones: list[Violacion], catalogo: catalogo_mod.Catalogo
) -> list[Clasificacion]:
    por_id = {c.violacion: c for c in respuesta.clasificaciones}
    resultado = []
    for v in violaciones:
        opinion = por_id[v.id]
        control = catalogo.control(v.control)
        resultado.append(
            Clasificacion(
                violacion=v.id,
                control=v.control,
                titulo_control=control.titulo if control else v.control,
                severidad=control.severidad if control else "Desconocida",
                marcos=control.marcos if control else [],
                recurso=v.recurso,
                mensaje=v.mensaje,
                **opinion.model_dump(exclude={"violacion"}),
            )
        )
    return resultado


async def analizar_async(
    veredicto: dict[str, Any],
    plan: dict[str, Any] | None,
    *,
    ambiente: str = "Dev",
    origen: str = "Plan",
    api_url: str | None = None,
    modelo: str | BaseLlm | None = None,
    catalogo: catalogo_mod.Catalogo | None = None,
    tiempo_limite: float = TIEMPO_LIMITE,
    intentos: int = INTENTOS,
) -> Decision:
    catalogo = catalogo or catalogo_mod.por_defecto()
    modelo = modelo or nombre_modelo()
    resultado = veredicto.get("resultado")
    resultado = resultado if resultado in RESULTADOS_VALIDOS else "error"
    violaciones = desde_veredicto(veredicto)

    base = dict(
        ejecucion_id=str(uuid.uuid4()),
        fecha=datetime.now(timezone.utc).isoformat(),
        origen=origen,
        ambiente=ambiente,
        commit=str(veredicto.get("commit", "desconocido")),
        resultado_compuerta=resultado,
        motivo_compuerta=str(veredicto.get("motivo", "")),
        version_prompt=VERSION_PROMPT,
        hash_entradas=_hash(veredicto, plan),
    )

    if resultado == "error":
        return Decision(
            **base,
            estado="sin_analisis",
            resumen="La compuerta no pudo evaluar el plan, así que no hay violaciones que analizar. "
            "El despliegue ya queda bloqueado por la compuerta.",
        )
    if not violaciones:
        return Decision(**base, estado="sin_violaciones", resumen="La compuerta no encontró violaciones.")

    estado_sesion = {CLAVE_RECURSOS: sanitizar.plan(plan or {}), CLAVE_API: api_url}
    mensaje = mensaje_para_modelo(violaciones, ambiente, origen)
    nombre = modelo if isinstance(modelo, str) else modelo.model

    ultimo_error = "sin intentos"
    herramientas: list[str] = []
    for _ in range(max(1, intentos)):
        try:
            respuesta, herramientas = await asyncio.wait_for(
                _una_corrida(modelo, mensaje, estado_sesion), timeout=tiempo_limite
            )
            _verificar_cobertura(respuesta, violaciones)
            return Decision(
                **base,
                estado="analizado",
                resumen=respuesta.resumen,
                clasificaciones=_armar_clasificaciones(respuesta, violaciones, catalogo),
                herramientas_usadas=herramientas,
                modelo=nombre,
            )
        except asyncio.TimeoutError:
            ultimo_error = f"el modelo no respondió en {tiempo_limite:.0f} s"
        except FalloAgente as error:
            ultimo_error = str(error)
        except Exception as error:  # noqa: BLE001 — cualquier fallo del modelo bloquea
            ultimo_error = f"{type(error).__name__}: {error}"[:500]

    return Decision(
        **base,
        estado="error_agente",
        resumen="El agente no pudo clasificar las violaciones. Por regla segura, el cambio queda bloqueado.",
        herramientas_usadas=herramientas,
        modelo=nombre,
        error=ultimo_error,
    )


def analizar(veredicto: dict[str, Any], plan: dict[str, Any] | None, **opciones: Any) -> Decision:
    return asyncio.run(analizar_async(veredicto, plan, **opciones))
