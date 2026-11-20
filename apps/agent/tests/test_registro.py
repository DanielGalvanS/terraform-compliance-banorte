"""Registro de la decisión en la API (POST /api/v1/decisiones)."""

from __future__ import annotations

import json

import httpx
import pytest

from agente import registro
from agente.cli import main
from agente.ejecutar import analizar

from conftest import DATOS, FIXTURES, RAIZ, ModeloFalso, leer

CONTRATO = RAIZ / "apps/api/test/datos/decision_agente.json"


def claves(valor):
    """La forma de un JSON: sus claves, recursivamente, sin los valores."""
    if isinstance(valor, dict):
        return {k: claves(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [claves(valor[0])] if valor else []
    return None


@pytest.fixture
def decision(veredicto_violaciones, plan_violaciones, modelo):
    return analizar(veredicto_violaciones, plan_violaciones, modelo=modelo)


def test_el_cuerpo_coincide_con_el_contrato_de_la_api(decision):
    """apps/api prueba su ruta con este mismo JSON. Si el agente cambia un
    campo, hay que regenerarlo (ver README) para que la API lo vea."""
    assert claves(registro.cuerpo(decision)) == claves(leer(CONTRATO))


def test_el_cuerpo_va_en_camel_case(decision):
    cuerpo = registro.cuerpo(decision)
    assert cuerpo["resultadoCompuerta"] == "bloqueado"
    assert cuerpo["clasificaciones"][0]["accionSugerida"]
    assert "resultado_compuerta" not in json.dumps(cuerpo)


@pytest.fixture
def api(monkeypatch):
    """Una API falsa que guarda lo que recibe."""
    recibidas = []

    def responder(peticion: httpx.Request) -> httpx.Response:
        recibidas.append(json.loads(peticion.content))
        if peticion.url.path != "/api/v1/decisiones":
            return httpx.Response(404)
        return httpx.Response(201, json={"evidencia": {"secuencia": 7, "hash": "sha256:x"}})

    monkeypatch.setattr(registro, "_TRANSPORTE", httpx.MockTransport(responder))
    return recibidas


def test_registra_en_la_api(decision, api):
    respuesta = registro.registrar("http://api.local/", decision)
    assert respuesta["evidencia"]["secuencia"] == 7
    assert api[0]["ejecucionId"] == decision.ejecucion_id


def test_un_rechazo_de_la_api_es_un_fallo_de_registro(decision, monkeypatch):
    monkeypatch.setattr(registro, "_TRANSPORTE", httpx.MockTransport(lambda p: httpx.Response(409, text="conflicto")))
    with pytest.raises(registro.FalloRegistro, match="409"):
        registro.registrar("http://api.local", decision)


@pytest.mark.parametrize("respuesta", [
    httpx.Response(200, text="<html>proxy</html>"),
    httpx.Response(201, json={"otra": "cosa"}),
])
def test_una_respuesta_rara_es_un_fallo_de_registro(decision, monkeypatch, respuesta):
    monkeypatch.setattr(registro, "_TRANSPORTE", httpx.MockTransport(lambda p: respuesta))
    with pytest.raises(registro.FalloRegistro, match="no es una decisión registrada"):
        registro.registrar("http://api.local", decision)


def test_api_caida_es_un_fallo_de_registro(decision, monkeypatch):
    def caida(peticion):
        raise httpx.ConnectError("sin conexión")

    monkeypatch.setattr(registro, "_TRANSPORTE", httpx.MockTransport(caida))
    with pytest.raises(registro.FalloRegistro, match="no respondió"):
        registro.registrar("http://api.local", decision)


def _correr_cli(tmp_path, monkeypatch, capsys):
    import agente.cli as cli

    original = cli.analizar
    monkeypatch.setattr(cli, "analizar", lambda *a, **k: original(*a, **{**k, "api_url": None}, modelo=ModeloFalso(peticiones=[])))
    salida = tmp_path / "decision.json"
    codigo = main([
        "analizar",
        "--veredicto", str(DATOS / "veredicto_violaciones.json"),
        "--plan", str(FIXTURES / "plan_violaciones.json"),
        "--salida", str(salida),
        "--api-url", "http://api.local",
    ])
    return codigo, salida, capsys.readouterr().err


def test_la_cli_registra_si_hay_api(tmp_path, monkeypatch, capsys, api):
    codigo, _, err = _correr_cli(tmp_path, monkeypatch, capsys)
    assert codigo == 0
    assert len(api) == 1
    assert "registrada en la API (evidencia #7)" in err


def test_si_la_api_falla_la_cli_avisa_sin_cambiar_el_resultado(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(registro, "_TRANSPORTE", httpx.MockTransport(lambda p: httpx.Response(500)))
    codigo, salida, err = _correr_cli(tmp_path, monkeypatch, capsys)
    assert codigo == 0
    assert "no se registró en la API" in err
    assert leer(salida)["estado"] == "analizado"
