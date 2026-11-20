"""Catálogo, extracción de recursos, privacidad y herramientas."""

from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from agente import catalogo, herramientas, sanitizar
from agente.ejecutar import analizar
from agente.violaciones import desde_veredicto, extraer_recurso

from conftest import DATOS, FIXTURES, RAIZ, con_secreto, leer

CONTROLES = {"CO-NET-01", "CO-NET-02", "CO-DB-01", "CO-DB-02", "CO-TAG-01", "CO-IAM-01", "CO-VM-01", "CO-SEC-01"}


class ContextoFalso:
    def __init__(self, estado):
        self.state = estado


def test_el_catalogo_carga_los_8_controles():
    cat = catalogo.cargar()
    assert set(cat.controles) == CONTROLES
    assert cat.control("co-net-01").severidad == "Crítica"
    assert "CIS GCP 3.6" in cat.control("CO-NET-01").marcos


def test_consultar_control_cita_cis_y_nist():
    datos = herramientas.consultar_control("CO-NET-01")
    marcos = {r["marco"] for r in datos["referencias"]}
    assert {"CIS GCP", "NIST 800-53"} <= marcos
    assert herramientas.consultar_control("CO-XXX-99") == {"encontrado": False, "codigo": "CO-XXX-99"}


def test_cada_violacion_trae_su_recurso(veredicto_violaciones):
    violaciones = desde_veredicto(veredicto_violaciones)
    assert {v.control for v in violaciones} == CONTROLES
    assert all(v.recurso for v in violaciones), [v for v in violaciones if not v.recurso]
    assert violaciones[0].recurso == "google_sql_database_instance.publica"


@pytest.mark.parametrize(
    "mensaje, esperado",
    [
        ("CO-NET-01: la regla 'module.firewall.google_compute_firewall.ssh' expone…", "module.firewall.google_compute_firewall.ssh"),
        ("CO-SEC-01: 'module.secretos.google_secret_manager_secret.estos[\"api\"]' declara…", 'module.secretos.google_secret_manager_secret.estos["api"]'),
        ("Mensaje sin recurso", None),
    ],
)
def test_extrae_direcciones_con_modulos_e_indices(mensaje, esperado):
    assert extraer_recurso(mensaje) == esperado


def test_lo_sanitizado_no_trae_valores_sensibles(plan_violaciones):
    plan = con_secreto(plan_violaciones, "S3cr3t0-Plantado")
    vista = json.dumps(sanitizar.plan(plan), ensure_ascii=False)

    assert "S3cr3t0-Plantado" not in vista
    assert "sa-deployer-qa@" not in vista  # correos fuera
    assert '"atributos_sensibles_declarados": ["password"]' in vista


def test_nada_sensible_llega_al_modelo(veredicto_violaciones, plan_violaciones, modelo):
    """Criterio de DEV-46: al modelo solo llegan metadatos de configuración."""
    plan = con_secreto(plan_violaciones, "S3cr3t0-Plantado")
    analizar(veredicto_violaciones, plan, modelo=modelo)

    todo = "\n".join(modelo.peticiones)
    assert modelo.peticiones, "el modelo no recibió nada"
    assert "S3cr3t0-Plantado" not in todo
    assert "sa-deployer-qa@" not in todo
    # Pero sí lo necesario para explicar CO-SEC-01.
    assert "atributos_sensibles_declarados" in todo


def test_vista_de_firewall_y_cuenta_por_defecto(plan_violaciones):
    vistas = sanitizar.plan(plan_violaciones)
    assert vistas["google_compute_firewall.allow_ssh"]["atributos"]["origenes"] == ["0.0.0.0/0"]
    expuesta = vistas["google_compute_instance.expuesta"]["atributos"]
    assert expuesta["ip_publica"] is True
    assert expuesta["cuenta_servicio"] == ["serviceAccount (cuenta por defecto de Compute)"]


def test_consultar_recurso_solo_lee_del_estado(plan_violaciones):
    contexto = ContextoFalso({herramientas.CLAVE_RECURSOS: sanitizar.plan(plan_violaciones)})
    assert herramientas.consultar_recurso("google_sql_user.app", contexto)["encontrado"] is True
    assert herramientas.consultar_recurso("/etc/passwd", contexto) == {"encontrado": False, "direccion": "/etc/passwd"}


def test_sin_api_las_busquedas_lo_dicen():
    contexto = ContextoFalso({herramientas.CLAVE_API: None})
    assert herramientas.buscar_hallazgos("CO-NET-01", "x", contexto)["disponible"] is False
    assert herramientas.buscar_excepciones("CO-NET-01", "x", contexto)["disponible"] is False


@pytest.mark.skipif(shutil.which("conftest") is None, reason="conftest no está instalado")
@pytest.mark.parametrize("nombre", ["violaciones", "conforme"])
def test_los_datos_de_prueba_coinciden_con_la_compuerta_real(tmp_path, nombre):
    """Si cambia una política, este dato fijo debe regenerarse (ver README)."""
    destino = tmp_path / "v.json"
    subprocess.run(
        ["bash", str(RAIZ / "infra/pipelines/scripts/policy_check.sh"), str(FIXTURES / f"plan_{nombre}.json"), str(destino)],
        check=False,
        capture_output=True,
    )
    real, fijo = leer(destino), leer(DATOS / f"veredicto_{nombre}.json")
    clave = lambda d: (d["resultado"], [(v["control"], v["mensaje"]) for v in d["violaciones"]])  # noqa: E731
    assert clave(real) == clave(fijo)
