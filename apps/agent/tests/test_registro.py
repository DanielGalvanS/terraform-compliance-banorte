"""Registro de la decisión en la API de cumplimiento."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from agente import acciones, herramientas
from agente.cli import main
from agente.ejecutar import analizar

from conftest import DATOS, FIXTURES, ModeloFalso

# Los campos que exige NuevaDecisionAgente en apps/api/src/model/esquemas.ts.
CAMPOS_API = {
    "ejecucionId", "fecha", "origen", "ambiente", "commit", "resultadoCompuerta", "estado",
    "resumen", "clasificaciones", "herramientasUsadas", "ajustes", "modelo", "versionPrompt",
    "hashEntradas", "error",
}
CAMPOS_CLASIFICACION = {
    "violacion", "control", "recurso", "severidad", "prioridad", "accionSugerida", "confianza",
    "explicacion", "remediacion",
}


@pytest.fixture
def api(monkeypatch):
    """API simulada. ``estado`` decide qué responde el POST; ``recibidas`` guarda lo enviado."""
    control = {"estado": 201, "recibidas": []}

    def manejar(peticion: httpx.Request) -> httpx.Response:
        if peticion.method == "POST":
            control["recibidas"].append(peticion)
            return httpx.Response(control["estado"], json={"error": "motivo de la API"})
        return httpx.Response(200, json={"hallazgos": [], "excepciones": []})

    monkeypatch.setattr(herramientas, "_TRANSPORTE", httpx.MockTransport(manejar))
    return control


@pytest.fixture
def decision_conforme(veredicto_conforme, modelo):
    return analizar(veredicto_conforme, None, modelo=modelo)


def test_el_formato_coincide_con_el_de_la_api(veredicto_violaciones, plan_violaciones, modelo):
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=modelo)
    cuerpo = acciones.para_api(decision)

    assert set(cuerpo) == CAMPOS_API
    assert set(cuerpo["clasificaciones"][0]) == CAMPOS_CLASIFICACION
    assert cuerpo["hashEntradas"].startswith("sha256:")
    json.dumps(cuerpo)  # serializable tal cual


def test_registra_con_el_token_del_agente(api, decision_conforme, monkeypatch):
    monkeypatch.setenv("API_TOKEN", "token-de-prueba")
    motivo = asyncio.run(acciones.registrar_en_api(decision_conforme, "http://api.prueba"))

    assert motivo is None
    peticion = api["recibidas"][0]
    assert peticion.url.path == "/api/v1/decisiones"
    assert peticion.headers["authorization"] == "Bearer token-de-prueba"
    assert json.loads(peticion.content)["ejecucionId"] == decision_conforme.ejecucion_id


def test_un_reintento_ya_registrado_cuenta_como_exito(api, decision_conforme):
    api["estado"] = 200
    assert asyncio.run(acciones.registrar_en_api(decision_conforme, "http://api.prueba")) is None


@pytest.mark.parametrize("estado", [401, 403, 409, 422, 500])
def test_un_rechazo_de_la_api_devuelve_el_motivo(api, decision_conforme, estado):
    api["estado"] = estado
    motivo = asyncio.run(acciones.registrar_en_api(decision_conforme, "http://api.prueba"))
    assert motivo == f"la API respondió {estado}: motivo de la API"


def test_la_api_caida_devuelve_el_motivo(monkeypatch, decision_conforme):
    def caida(peticion: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("sin red", request=peticion)

    monkeypatch.setattr(herramientas, "_TRANSPORTE", httpx.MockTransport(caida))
    motivo = asyncio.run(acciones.registrar_en_api(decision_conforme, "http://api.prueba"))
    assert motivo is not None and "no se pudo contactar" in motivo


def _cli(tmp_path, *extra):
    return main([
        "analizar",
        "--veredicto", str(DATOS / "veredicto_conforme.json"),
        "--salida", str(tmp_path / "decision.json"),
        *extra,
    ])


def test_cli_registra_y_sale_con_0(api, tmp_path):
    assert _cli(tmp_path, "--api-url", "http://api.prueba") == 0
    assert len(api["recibidas"]) == 1


def test_cli_bloquea_si_no_puede_registrar(api, tmp_path):
    api["estado"] = 500
    assert _cli(tmp_path, "--api-url", "http://api.prueba") == 1
    # La decisión local se escribe igual: es el artefacto del pipeline.
    assert (tmp_path / "decision.json").exists()


def test_cli_sin_api_no_registra(api, tmp_path, monkeypatch):
    monkeypatch.delenv("API_URL", raising=False)
    assert _cli(tmp_path) == 0
    assert api["recibidas"] == []


def test_cli_registra_tambien_un_error_del_agente(api, tmp_path, monkeypatch):
    import agente.cli as cli

    original = cli.analizar
    monkeypatch.setattr(cli, "analizar", lambda *a, **k: original(*a, **k, modelo=ModeloFalso(error="caído", peticiones=[])))
    codigo = main([
        "analizar",
        "--veredicto", str(DATOS / "veredicto_violaciones.json"),
        "--plan", str(FIXTURES / "plan_violaciones.json"),
        "--salida", str(tmp_path / "decision.json"),
        "--api-url", "http://api.prueba",
    ])

    assert codigo == 1
    assert json.loads(api["recibidas"][0].content)["estado"] == "error_agente"


def test_las_busquedas_filtran_por_recurso_en_la_api(monkeypatch):
    pedidas: list[httpx.Request] = []

    def manejar(peticion: httpx.Request) -> httpx.Response:
        pedidas.append(peticion)
        return httpx.Response(200, json={"hallazgos": []})

    monkeypatch.setattr(herramientas, "_TRANSPORTE", httpx.MockTransport(manejar))

    class Contexto:
        state = {herramientas.CLAVE_API: "http://api.prueba"}

    asyncio.run(herramientas.buscar_hallazgos("CO-NET-01", "module.fw.google_compute_firewall.ssh", Contexto()))
    assert pedidas[0].url.params["recurso"] == "module.fw.google_compute_firewall.ssh"
