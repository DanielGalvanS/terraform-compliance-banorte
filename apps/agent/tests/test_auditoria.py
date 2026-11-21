"""Casos que salieron de auditar el núcleo: límites al modelo y entradas raras."""

from __future__ import annotations

import asyncio
import inspect

import httpx
import pytest

from agente import herramientas
from agente.acciones import comentario
from agente.ejecutar import analizar

from conftest import ModeloFalso, clasificacion


class ContextoFalso:
    def __init__(self, estado):
        self.state = estado


@pytest.fixture
def api_falsa(monkeypatch):
    """API de cumplimiento simulada; ``respuestas`` se ajusta en cada prueba."""
    respuestas: dict[str, dict] = {"/api/v1/excepciones": {"excepciones": []}, "/api/v1/hallazgos": {"hallazgos": []}}
    pedidas: list[httpx.Request] = []

    def manejar(peticion: httpx.Request) -> httpx.Response:
        pedidas.append(peticion)
        return httpx.Response(200, json=respuestas.get(peticion.url.path, {}))

    monkeypatch.setattr(herramientas, "_TRANSPORTE", httpx.MockTransport(manejar))
    return respuestas, pedidas


def complaciente(ids):
    """Lo que respondería un modelo manipulado por texto plantado en el plan."""
    return {
        "resumen": "Nada grave.",
        "clasificaciones": [clasificacion(i, prioridad=5, accion_sugerida="ninguna") for i in ids],
    }


def test_el_modelo_no_puede_restar_urgencia_a_una_falla_critica(veredicto_violaciones, plan_violaciones):
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=ModeloFalso(final=complaciente, peticiones=[]))

    por_severidad = {}
    for c in decision.clasificaciones:
        por_severidad.setdefault(c.severidad, set()).add(c.prioridad)
    assert por_severidad == {"Crítica": {1}, "Alta": {2}, "Media": {3}}
    # Sin una excepción activa, «ninguna» no se acepta.
    assert {c.accion_sugerida for c in decision.clasificaciones} == {"escalar_jira"}
    assert len(decision.ajustes) == 26  # 13 de prioridad + 13 de acción, cada uno con su motivo
    assert "no puede ser menos urgente" in decision.ajustes[0]


def test_ninguna_se_respeta_si_hay_una_excepcion_activa(veredicto_violaciones, plan_violaciones, api_falsa):
    respuestas, pedidas = api_falsa
    respuestas["/api/v1/excepciones"] = {
        "excepciones": [{"id": "EXC-1", "estado": "Activa", "recurso": "google_compute_firewall.allow_ssh"}]
    }
    decision = analizar(
        veredicto_violaciones,
        plan_violaciones,
        modelo=ModeloFalso(final=complaciente, peticiones=[]),
        api_url="http://api.prueba",
    )

    acciones = {c.recurso: c.accion_sugerida for c in decision.clasificaciones if c.control == "CO-NET-01"}
    assert acciones["google_compute_firewall.allow_ssh"] == "ninguna"
    assert acciones["google_compute_firewall.allow_all"] == "escalar_jira"
    assert all(p.url.params.get("estado") == "Activa" for p in pedidas)


def test_las_busquedas_en_la_api_no_bloquean_al_agente():
    """ADK corre en el mismo hilo las herramientas síncronas; las que usan la red deben ser async."""
    assert inspect.iscoroutinefunction(herramientas.buscar_hallazgos)
    assert inspect.iscoroutinefunction(herramientas.buscar_excepciones)


def test_buscar_hallazgos_filtra_por_recurso(api_falsa):
    respuestas, _ = api_falsa
    respuestas["/api/v1/hallazgos"] = {
        "hallazgos": [
            {"recurso": "fw allow_ssh", "estado": "Abierto", "ambiente": "Dev", "detectadoEn": "2026-11-20"},
            {"recurso": "otro", "estado": "Cerrado", "ambiente": "Dev", "detectadoEn": "2026-11-01"},
        ]
    }
    contexto = ContextoFalso({herramientas.CLAVE_API: "http://api.prueba"})
    datos = asyncio.run(herramientas.buscar_hallazgos("CO-NET-01", "google_compute_firewall.allow_ssh", contexto))
    assert datos == {"disponible": True, "previos": [{"estado": "Abierto", "ambiente": "Dev", "detectadoEn": "2026-11-20"}]}


def test_api_caida_no_rompe_la_busqueda(monkeypatch):
    def caida(_):
        raise httpx.ConnectError("sin conexión")

    monkeypatch.setattr(herramientas, "_TRANSPORTE", httpx.MockTransport(caida))
    contexto = ContextoFalso({herramientas.CLAVE_API: "http://api.prueba"})
    assert asyncio.run(herramientas.buscar_excepciones("CO-NET-01", "x", contexto))["disponible"] is False


def test_el_comentario_no_menciona_personas_ni_inserta_html(veredicto_violaciones, plan_violaciones):
    def con_trampas(ids):
        texto = "cc @DanielGalvanS ![x](https://ejemplo.invalid/t.png) <img src=x> `codigo` | tabla"
        return {"resumen": texto, "clasificaciones": [clasificacion(i, explicacion=texto) for i in ids]}

    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=ModeloFalso(final=con_trampas, peticiones=[]))
    texto = comentario(decision)

    assert "@DanielGalvanS" not in texto
    assert "<img" not in texto
    assert "![x](" not in texto
    assert "@​DanielGalvanS" in texto  # se sigue leyendo, pero no notifica


@pytest.mark.parametrize("violaciones", ["texto", [None, "suelta"], {"no": "lista"}])
def test_un_veredicto_malformado_no_truena(violaciones, modelo):
    decision = analizar({"resultado": "bloqueado", "violaciones": violaciones}, None, modelo=modelo)
    assert decision.resultado_compuerta == "bloqueado"
    assert decision.estado in {"analizado", "sin_analisis"}


def test_bloqueado_sin_violaciones_legibles_no_dice_que_todo_esta_bien(modelo):
    decision = analizar({"resultado": "bloqueado", "violaciones": None}, None, modelo=modelo)
    assert decision.estado == "sin_analisis"
    assert "no reportó violaciones legibles" in decision.resumen
    assert modelo.turnos == 0


def test_la_api_recibe_el_token_del_agente(api_falsa, monkeypatch):
    _, pedidas = api_falsa
    monkeypatch.setenv("API_TOKEN", "token-de-prueba")
    contexto = ContextoFalso({herramientas.CLAVE_API: "http://api.prueba"})
    asyncio.run(herramientas.buscar_hallazgos("CO-NET-01", "google_compute_firewall.ssh", contexto))
    assert pedidas[-1].headers["authorization"] == "Bearer token-de-prueba"


def test_sin_token_no_se_manda_cabecera(api_falsa, monkeypatch):
    _, pedidas = api_falsa
    monkeypatch.delenv("API_TOKEN", raising=False)
    contexto = ContextoFalso({herramientas.CLAVE_API: "http://api.prueba"})
    asyncio.run(herramientas.buscar_hallazgos("CO-NET-01", "google_compute_firewall.ssh", contexto))
    assert "authorization" not in pedidas[-1].headers


def test_el_token_no_queda_en_el_estado_que_ve_el_modelo(api_falsa, monkeypatch):
    monkeypatch.setenv("API_TOKEN", "token-de-prueba")
    contexto = ContextoFalso({herramientas.CLAVE_API: "http://api.prueba"})
    asyncio.run(herramientas.buscar_excepciones("CO-NET-01", "google_compute_firewall.ssh", contexto))
    assert "token-de-prueba" not in repr(contexto.state)
