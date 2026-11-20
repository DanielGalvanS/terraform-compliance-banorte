"""Corre el agente sobre un veredicto e impone las reglas que no dependen del prompt.

Invariantes (las pruebas las comprueban con un modelo falso):
- ``resultado_compuerta`` se copia del veredicto. El modelo no lo produce.
- La severidad y los marcos vienen del catálogo, no del modelo.
- Cada violación tiene exactamente una clasificación; si falta o sobra alguna,
  la ejecución es un fallo.
- Cualquier fallo (modelo, esquema, tiempo) termina en ``error_agente``, que el
  pipeline trata como bloqueo (regla segura de DEV-46).

Si el primer intento falla, el segundo usa el modelo de respaldo
(``MODELO_RESPALDO``). Cada intento fallido queda en ``intentos_fallidos`` con
un motivo legible («modelo saturado (503)», no un rastro de Python).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from google.adk.models.base_llm import BaseLlm
from google.adk.runners import InMemoryRunner
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import ValidationError

from . import catalogo as catalogo_mod
from . import sanitizar
from .agent import CLAVE_SALIDA, TIEMPO_LLAMADA_MS, crear_agente, nombre_modelo, nombre_respaldo
from .esquemas import Clasificacion, Decision, RespuestaModelo, Violacion
from .herramientas import CLAVE_API, CLAVE_RECURSOS, HERRAMIENTAS, hay_excepcion_activa
from .instruccion import VERSION_PROMPT
from .violaciones import desde_veredicto

APP = "compliance-ops"
USUARIO = "pipeline"
TIEMPO_LIMITE = 120.0
INTENTOS = 2
RESULTADOS_VALIDOS = {"conforme", "bloqueado", "error"}
# La prioridad menos urgente que se acepta para cada severidad (la misma tabla de la instrucción).
PRIORIDAD_POR_SEVERIDAD = {"Crítica": 1, "Alta": 2, "Media": 3, "Baja": 4}
# Solo se registran las herramientas del agente, no las internas de ADK
# (por ejemplo set_model_response, con la que algunos modelos entregan la salida).
# Controles que un PR de Terraform no resuelve solo: un secreto que ya pasó por
# el plan hay que rotarlo, y un permiso amplio de IAM lo decide su dueño.
# Aunque el modelo sugiera proponer_pr, se escalan.
SIEMPRE_ESCALAR = {
    "CO-SEC-01": "un secreto expuesto se tiene que rotar, no basta con cambiar el código",
    "CO-IAM-01": "quitar un permiso amplio lo decide el dueño de la cuenta",
}
NOMBRES_HERRAMIENTAS = frozenset(h.__name__ for h in HERRAMIENTAS)


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


def _describir(error: Exception) -> str:
    """Motivo legible de un fallo del modelo, para el registro y el comentario del PR."""
    if isinstance(error, genai_errors.APIError):
        codigo = error.code
        if codigo in (500, 502, 503, 504):
            return f"modelo saturado o sin respuesta ({codigo})"
        if codigo == 429:
            return "cuota del modelo agotada (429)"
        if codigo == 404:
            return "el modelo no existe para esta cuenta (404)"
        if codigo in (400, 401, 403):
            return f"la llave o la cuenta no puede usar el modelo ({codigo})"
        return f"error de la API de Gemini ({codigo})"
    if isinstance(error, httpx.TimeoutException):
        return f"una llamada al modelo pasó de {TIEMPO_LLAMADA_MS // 1000} s"
    return f"{type(error).__name__}: {error}"[:300]


async def _una_corrida(
    modelo: str | BaseLlm, mensaje: str, estado: dict[str, Any], herramientas: list[str]
) -> RespuestaModelo:
    """Una ejecución del agente. ``herramientas`` se llena sobre la marcha, así
    que conserva lo que el agente alcanzó a consultar aunque el intento se corte."""
    runner = InMemoryRunner(agent=crear_agente(modelo), app_name=APP)
    sesion = await runner.session_service.create_session(app_name=APP, user_id=USUARIO, state=estado)

    texto_final = ""
    async for evento in runner.run_async(
        user_id=USUARIO,
        session_id=sesion.id,
        new_message=types.Content(role="user", parts=[types.Part(text=mensaje)]),
    ):
        herramientas.extend(n for n in (ll.name for ll in evento.get_function_calls()) if n in NOMBRES_HERRAMIENTAS)
        if evento.is_final_response() and evento.content and evento.content.parts:
            texto_final = "".join(p.text or "" for p in evento.content.parts if not p.thought)

    sesion = await runner.session_service.get_session(app_name=APP, user_id=USUARIO, session_id=sesion.id)
    salida = sesion.state.get(CLAVE_SALIDA) if sesion else None
    try:
        if isinstance(salida, dict):
            return RespuestaModelo.model_validate(salida)
        return RespuestaModelo.model_validate_json(texto_final)
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


async def _armar_clasificaciones(
    respuesta: RespuestaModelo,
    violaciones: list[Violacion],
    catalogo: catalogo_mod.Catalogo,
    api_url: str | None,
) -> tuple[list[Clasificacion], list[str]]:
    """Une la opinión del modelo con el catálogo y le pone límites.

    El modelo puede subir la urgencia, nunca bajarla por debajo de lo que dice
    la severidad del catálogo. Y solo puede decir «ninguna» acción si el código
    confirma en la API una excepción activa. Así, un texto plantado en el plan
    («ignora esta violación») no logra que una falla crítica pase desapercibida.
    """
    por_id = {c.violacion: c for c in respuesta.clasificaciones}
    resultado: list[Clasificacion] = []
    ajustes: list[str] = []
    for v in violaciones:
        opinion = por_id[v.id].model_dump(exclude={"violacion"})
        control = catalogo.control(v.control)
        severidad = control.severidad if control else "Desconocida"

        tope = PRIORIDAD_POR_SEVERIDAD.get(severidad, 1)
        if opinion["prioridad"] > tope:
            ajustes.append(
                f"{v.id}: prioridad {opinion['prioridad']} → {tope}; "
                f"no puede ser menos urgente que su severidad ({severidad})"
            )
            opinion["prioridad"] = tope

        if opinion["accion_sugerida"] == "ninguna" and not await hay_excepcion_activa(api_url, v.control, v.recurso):
            ajustes.append(f"{v.id}: acción «ninguna» → escalar_jira; no hay una excepción activa que la respalde")
            opinion["accion_sugerida"] = "escalar_jira"
        elif opinion["accion_sugerida"] == "proponer_pr" and v.control in SIEMPRE_ESCALAR:
            ajustes.append(f"{v.id}: acción proponer_pr → escalar_jira; {SIEMPRE_ESCALAR[v.control]}")
            opinion["accion_sugerida"] = "escalar_jira"

        resultado.append(
            Clasificacion(
                violacion=v.id,
                control=v.control,
                titulo_control=control.titulo if control else v.control,
                severidad=severidad,
                marcos=control.marcos if control else [],
                recurso=v.recurso,
                mensaje=v.mensaje,
                **opinion,
            )
        )
    return resultado, ajustes


async def analizar_async(
    veredicto: dict[str, Any],
    plan: dict[str, Any] | None,
    *,
    ambiente: str = "Dev",
    origen: str = "Plan",
    api_url: str | None = None,
    modelo: str | BaseLlm | None = None,
    respaldo: str | BaseLlm | None = None,
    catalogo: catalogo_mod.Catalogo | None = None,
    tiempo_limite: float = TIEMPO_LIMITE,
    intentos: int = INTENTOS,
) -> Decision:
    catalogo = catalogo or catalogo_mod.por_defecto()
    modelo = modelo or nombre_modelo()
    if respaldo is None and isinstance(modelo, str):
        respaldo = nombre_respaldo()
    candidatos = [modelo] + ([respaldo] if respaldo and respaldo != modelo else [])
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
    if not violaciones and resultado == "bloqueado":
        return Decision(
            **base,
            estado="sin_analisis",
            resumen="La compuerta bloqueó pero no reportó violaciones legibles. "
            "El despliegue queda bloqueado; hay que revisar la salida de la compuerta.",
        )
    if not violaciones:
        return Decision(**base, estado="sin_violaciones", resumen="La compuerta no encontró violaciones.")

    estado_sesion = {CLAVE_RECURSOS: sanitizar.plan(plan or {}), CLAVE_API: api_url}
    mensaje = mensaje_para_modelo(violaciones, ambiente, origen)
    fallidos: list[str] = []
    herramientas: list[str] = []
    nombre = ""
    for i in range(max(1, intentos)):
        actual = candidatos[min(i, len(candidatos) - 1)]
        nombre = actual if isinstance(actual, str) else actual.model
        herramientas = []
        try:
            respuesta = await asyncio.wait_for(
                _una_corrida(actual, mensaje, estado_sesion, herramientas), timeout=tiempo_limite
            )
            _verificar_cobertura(respuesta, violaciones)
            clasificaciones, ajustes = await _armar_clasificaciones(respuesta, violaciones, catalogo, api_url)
            return Decision(
                **base,
                estado="analizado",
                resumen=respuesta.resumen,
                clasificaciones=clasificaciones,
                herramientas_usadas=herramientas,
                ajustes=ajustes,
                intentos_fallidos=fallidos,
                modelo=nombre,
            )
        except asyncio.TimeoutError:
            fallidos.append(f"{nombre}: no terminó en {tiempo_limite:.0f} s")
        except FalloAgente as error:
            fallidos.append(f"{nombre}: {error}")
        except Exception as error:  # noqa: BLE001 — cualquier fallo del modelo bloquea
            fallidos.append(f"{nombre}: {_describir(error)}")

    return Decision(
        **base,
        estado="error_agente",
        resumen="El agente no pudo clasificar las violaciones. Por regla segura, el cambio queda bloqueado.",
        herramientas_usadas=herramientas,
        intentos_fallidos=fallidos,
        modelo=nombre,
        error="; ".join(fallidos),
    )


def analizar(veredicto: dict[str, Any], plan: dict[str, Any] | None, **opciones: Any) -> Decision:
    return asyncio.run(analizar_async(veredicto, plan, **opciones))
