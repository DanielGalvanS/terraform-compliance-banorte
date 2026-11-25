"""Modelo saturado: respaldo, motivos legibles y lo que se conserva al cortar.

Casos de la primera prueba con Gemini real (19 nov): todos los modelos flash
respondían 503 y el agente solo decía «no respondió en 120 s».
"""

from __future__ import annotations

import pytest
from google.adk.models.google_llm import Gemini
from google.genai import errors

from agente import acciones, agent
from agente.ejecutar import analizar

from conftest import DATOS, ModeloFalso


def saturado() -> errors.ServerError:
    return errors.ServerError(
        503, {"error": {"code": 503, "message": "This model is currently experiencing high demand.", "status": "UNAVAILABLE"}}
    )


def test_si_el_principal_esta_saturado_responde_el_respaldo(veredicto_violaciones, plan_violaciones):
    principal = ModeloFalso(model="principal", excepcion=saturado(), peticiones=[])
    respaldo = ModeloFalso(model="respaldo", peticiones=[])

    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=principal, respaldo=respaldo)

    assert decision.estado == "analizado"
    assert decision.modelo == "respaldo"
    assert decision.intentos_fallidos == ["principal: modelo saturado o sin respuesta (503)"]
    assert decision.error is None
    assert "Respondió el modelo de respaldo" in acciones.comentario(decision)


def test_si_los_dos_fallan_dice_por_que(veredicto_violaciones, plan_violaciones):
    decision = analizar(
        veredicto_violaciones,
        plan_violaciones,
        modelo=ModeloFalso(model="principal", excepcion=saturado(), peticiones=[]),
        respaldo=ModeloFalso(model="respaldo", excepcion=errors.ClientError(429, {"error": {"code": 429}}), peticiones=[]),
    )

    assert decision.estado == "error_agente"
    assert decision.error == "principal: modelo saturado o sin respuesta (503); respaldo: cuota del modelo agotada (429)"


def test_un_corte_por_tiempo_conserva_las_herramientas(veredicto_violaciones, plan_violaciones):
    lento = ModeloFalso(espera=5, peticiones=[])

    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=lento, tiempo_limite=0.5, intentos=1)

    assert decision.estado == "error_agente"
    assert decision.herramientas_usadas == ["consultar_control", "consultar_recurso"]
    assert "no terminó en" in decision.error


def test_no_registra_las_herramientas_internas_de_adk(veredicto_violaciones, plan_violaciones):
    """Gemini real entrega la salida llamando a set_model_response; no es una herramienta del agente."""
    modelo = ModeloFalso(por_set_model_response=True, peticiones=[])

    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=modelo)

    assert decision.estado == "analizado"
    assert len(decision.clasificaciones) == 13
    assert decision.herramientas_usadas == ["consultar_control", "consultar_recurso"]


def test_el_respaldo_sale_del_entorno(monkeypatch):
    monkeypatch.delenv("MODELO_RESPALDO", raising=False)
    assert agent.nombre_respaldo() == "gemini-3.5-flash-lite"
    monkeypatch.setenv("MODELO_RESPALDO", "")
    assert agent.nombre_respaldo() is None


def test_cada_llamada_a_gemini_tiene_limite_y_pocos_reintentos():
    agente = agent.crear_agente("gemini-3.5-flash")

    assert isinstance(agente.model, Gemini)
    assert agente.model.retry_options.attempts == 2
    assert agente.generate_content_config.http_options.timeout == agent.TIEMPO_LLAMADA_MS


@pytest.mark.parametrize(
    "error, motivo",
    [
        (errors.ClientError(404, {"error": {"code": 404}}), "el modelo no existe para esta cuenta (404)"),
        (errors.ClientError(400, {"error": {"code": 400}}), "la llave o la cuenta no puede usar el modelo (400)"),
        (
            errors.ClientError(403, {"error": {"code": 403, "message": "PERMISSION_DENIED"}}),
            "la llave o la cuenta no puede usar el modelo (403)",
        ),
        (
            errors.ClientError(
                403,
                {
                    "error": {
                        "code": 403,
                        "message": "Access requires an eligible paid billing account in a supported region, "
                        "subject to our terms and policies.",
                        "status": "PERMISSION_DENIED",
                    }
                },
            ),
            "Vertex AI exige una cuenta de facturación de pago (403)",
        ),
        (errors.ServerError(504, {"error": {"code": 504}}), "modelo saturado o sin respuesta (504)"),
    ],
)
def test_motivos_legibles(veredicto_violaciones, plan_violaciones, error, motivo):
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=ModeloFalso(excepcion=error, peticiones=[]), intentos=1)
    assert decision.error == f"modelo-falso: {motivo}"


def test_secretos_e_iam_siempre_se_escalan(veredicto_violaciones, plan_violaciones, modelo):
    """En la prueba real, lite sugirió un PR para la contraseña en texto plano."""
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=modelo)  # el falso sugiere proponer_pr a todo

    acciones_por_control = {c.control: c.accion_sugerida for c in decision.clasificaciones}
    assert acciones_por_control["CO-SEC-01"] == "escalar_jira"
    assert acciones_por_control["CO-IAM-01"] == "escalar_jira"
    assert acciones_por_control["CO-TAG-01"] == "proponer_pr"
    assert any("rotar" in a for a in decision.ajustes)


GUION_CLI = """
import sys
sys.path[:0] = [".", "tests"]
import agente.cli as cli
from conftest import ModeloFalso
from test_respaldo import saturado
original = cli.analizar
cli.analizar = lambda *a, **k: original(*a, **k, modelo=ModeloFalso(excepcion=saturado(), peticiones=[]), intentos=1)
sys.exit(cli.main(sys.argv[1:]))
"""


def test_la_cli_no_imprime_el_rastro_de_adk(tmp_path):
    """En un proceso aparte: dentro de pytest los logs se capturan y no se verían."""
    import os
    import subprocess
    import sys
    from pathlib import Path

    entorno = {k: v for k, v in os.environ.items() if k != "AGENTE_DEBUG"}
    corrida = subprocess.run(
        [sys.executable, "-c", GUION_CLI, "analizar",
         "--veredicto", str(DATOS / "veredicto_violaciones.json"),
         "--salida", str(tmp_path / "decision.json")],
        cwd=Path(__file__).parents[1], env=entorno, capture_output=True, text=True, check=False,
    )

    assert corrida.returncode == 1
    assert "Traceback" not in corrida.stderr
    assert "modelo saturado o sin respuesta (503)" in corrida.stderr


def test_sin_credenciales_lo_dice_y_no_prueba_el_respaldo(veredicto_violaciones, plan_violaciones):
    sin_llave = ValueError("No API key was provided. Please pass a valid API key.")
    respaldo = ModeloFalso(model="respaldo", peticiones=[])

    decision = analizar(
        veredicto_violaciones,
        plan_violaciones,
        modelo=ModeloFalso(model="principal", excepcion=sin_llave, peticiones=[]),
        respaldo=respaldo,
    )

    assert decision.estado == "error_agente"
    assert decision.error.startswith("principal: no hay credenciales de Gemini: define GOOGLE_API_KEY")
    assert respaldo.turnos == 0
