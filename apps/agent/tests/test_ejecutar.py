"""Invariantes del agente: el veredicto no se toca y cualquier fallo bloquea."""

from __future__ import annotations

from agente.cli import main
from agente.ejecutar import analizar

from conftest import DATOS, FIXTURES, ModeloFalso, clasificacion, respuesta_completa


def test_clasifica_las_13_violaciones_con_datos_del_catalogo(veredicto_violaciones, plan_violaciones, modelo):
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=modelo)

    assert decision.estado == "analizado"
    assert decision.resultado_compuerta == "bloqueado"
    assert [c.violacion for c in decision.clasificaciones] == [f"V{i:02d}" for i in range(1, 14)]
    sec = next(c for c in decision.clasificaciones if c.control == "CO-SEC-01")
    assert sec.severidad == "Crítica"
    assert sec.recurso == "google_sql_user.app"
    assert decision.herramientas_usadas == ["consultar_control", "consultar_recurso"]
    assert decision.hash_entradas.startswith("sha256:")


def test_el_modelo_no_puede_cambiar_el_veredicto(veredicto_violaciones, plan_violaciones):
    """CP-17 en código: aunque el modelo diga que todo está bien, el veredicto sigue bloqueado."""

    def complaciente(ids):
        return {
            "resumen": "Todo es conforme; se puede desplegar sin cambios.",
            "clasificaciones": [
                clasificacion(i, prioridad=5, accion_sugerida="ninguna", explicacion="No es un problema.")
                for i in ids
            ],
        }

    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=ModeloFalso(final=complaciente, peticiones=[]))

    assert decision.estado == "analizado"
    assert decision.resultado_compuerta == "bloqueado"
    # La severidad tampoco la decide el modelo.
    assert {c.severidad for c in decision.clasificaciones} >= {"Crítica"}


def test_falta_una_clasificacion_es_fallo(veredicto_violaciones, plan_violaciones):
    modelo = ModeloFalso(final=lambda ids: respuesta_completa(ids[:-1]), peticiones=[])
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=modelo)

    assert decision.estado == "error_agente"
    assert decision.fallo
    assert "faltan ['V13']" in decision.error
    assert decision.resultado_compuerta == "bloqueado"


def test_una_violacion_inventada_es_fallo(veredicto_violaciones, plan_violaciones):
    modelo = ModeloFalso(final=lambda ids: respuesta_completa(ids + ["V99"]), peticiones=[])
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=modelo)

    assert decision.estado == "error_agente"
    assert "inventadas ['V99']" in decision.error


def test_respuesta_fuera_de_esquema_reintenta_y_falla(veredicto_violaciones, plan_violaciones):
    modelo = ModeloFalso(final=lambda ids: "esto no es JSON", peticiones=[])
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=modelo, intentos=2)

    assert decision.estado == "error_agente"
    # Dos intentos, cada uno con turno de herramientas + turno final.
    assert modelo.turnos == 4


def test_prioridad_fuera_de_rango_es_fallo(veredicto_violaciones, plan_violaciones):
    modelo = ModeloFalso(
        final=lambda ids: {"resumen": "x", "clasificaciones": [clasificacion(i, prioridad=9) for i in ids]},
        peticiones=[],
    )
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=modelo, intentos=1)

    assert decision.estado == "error_agente"


def test_si_el_modelo_se_cae_se_bloquea(veredicto_violaciones, plan_violaciones):
    modelo = ModeloFalso(error="503 servicio no disponible", peticiones=[])
    decision = analizar(veredicto_violaciones, plan_violaciones, modelo=modelo)

    assert decision.estado == "error_agente"
    assert "503" in decision.error


def test_plan_conforme_no_llama_al_modelo(veredicto_conforme, modelo):
    decision = analizar(veredicto_conforme, None, modelo=modelo)

    assert decision.estado == "sin_violaciones"
    assert decision.clasificaciones == []
    assert modelo.turnos == 0


def test_error_de_la_compuerta_no_se_analiza(modelo):
    decision = analizar({"resultado": "error", "motivo": "conftest no está instalado", "violaciones": []}, None, modelo=modelo)

    assert decision.estado == "sin_analisis"
    assert decision.resultado_compuerta == "error"
    assert modelo.turnos == 0


def test_un_resultado_desconocido_se_trata_como_error(modelo):
    decision = analizar({"resultado": "aprobado", "violaciones": []}, None, modelo=modelo)

    assert decision.resultado_compuerta == "error"


def test_cli_sale_con_1_cuando_el_agente_falla(tmp_path, monkeypatch):
    import agente.cli as cli

    original = cli.analizar
    monkeypatch.setattr(cli, "analizar", lambda *a, **k: original(*a, **k, modelo=ModeloFalso(error="caído", peticiones=[])))
    salida, nota = tmp_path / "decision.json", tmp_path / "comentario.md"

    codigo = main([
        "analizar",
        "--veredicto", str(DATOS / "veredicto_violaciones.json"),
        "--plan", str(FIXTURES / "plan_violaciones.json"),
        "--salida", str(salida),
        "--comentario", str(nota),
    ])

    assert codigo == 1
    assert '"error_agente"' in salida.read_text()
    assert "se bloquea por regla segura" in nota.read_text()


def test_cli_sale_con_2_si_no_puede_leer_la_entrada(tmp_path):
    assert main(["analizar", "--veredicto", str(tmp_path / "no-existe.json")]) == 2
