"""Qué parte del plan puede ver el modelo.

Criterio de DEV-46: al modelo solo llegan metadatos de configuración. Por eso
esto es una lista de lo permitido y no de lo prohibido: un atributo que nadie
pensó en revisar no sale. De cada tipo de recurso se extraen solo los datos que
las 8 políticas necesitan para explicarse; el resto (nombres de usuario,
correos, valores de secretos, contraseñas) nunca se copia.
"""

from __future__ import annotations

from typing import Any, Callable

Recurso = dict[str, Any]


def _lista(valor: Any) -> list[Any]:
    if valor is None:
        return []
    return valor if isinstance(valor, list) else [valor]


def _primero(valor: Any) -> dict[str, Any]:
    for elemento in _lista(valor):
        if isinstance(elemento, dict):
            return elemento
    return {}


def _claves_etiquetas(etiquetas: Any) -> list[str]:
    # Solo los nombres: el valor de una etiqueta puede ser un dueño o un centro de costos.
    return sorted(etiquetas.keys()) if isinstance(etiquetas, dict) else []


def _tipo_miembro(miembro: Any) -> str:
    texto = str(miembro or "")
    tipo = texto.split(":", 1)[0] if ":" in texto else "desconocido"
    if texto.endswith("-compute@developer.gserviceaccount.com"):
        return f"{tipo} (cuenta por defecto de Compute)"
    return tipo


def _firewall(despues: Recurso) -> Recurso:
    return {
        "direccion_trafico": despues.get("direction"),
        "prioridad": despues.get("priority"),
        "origenes": _lista(despues.get("source_ranges")),
        "permite": [
            {"protocolo": a.get("protocol"), "puertos": _lista(a.get("ports"))}
            for a in _lista(despues.get("allow"))
            if isinstance(a, dict)
        ],
        "niega": [
            {"protocolo": d.get("protocol"), "puertos": _lista(d.get("ports"))}
            for d in _lista(despues.get("deny"))
            if isinstance(d, dict)
        ],
    }


def _sql(despues: Recurso) -> Recurso:
    ajustes = _primero(despues.get("settings"))
    ip = _primero(ajustes.get("ip_configuration"))
    return {
        "version_motor": despues.get("database_version"),
        "ip_publica": bool(ip.get("ipv4_enabled", False)),
        "red_privada": bool(ip.get("private_network")),
        "llave_cmek": bool(despues.get("encryption_key_name")),
        "etiquetas": _claves_etiquetas(ajustes.get("user_labels")),
        "respaldos": bool(_primero(ajustes.get("backup_configuration")).get("enabled", False)),
    }


def _instancia(despues: Recurso) -> Recurso:
    interfaces = [i for i in _lista(despues.get("network_interface")) if isinstance(i, dict)]
    cuentas = [c for c in _lista(despues.get("service_account")) if isinstance(c, dict)]
    return {
        "tipo_maquina": despues.get("machine_type"),
        "ip_publica": any(_lista(i.get("access_config")) for i in interfaces),
        "cuenta_servicio": [_tipo_miembro(f"serviceAccount:{c.get('email', '')}") for c in cuentas],
        "etiquetas": _claves_etiquetas(despues.get("labels")),
    }


def _iam(despues: Recurso) -> Recurso:
    miembros = _lista(despues.get("member")) + _lista(despues.get("members"))
    return {
        "rol": despues.get("role"),
        "tipo_miembros": sorted({_tipo_miembro(m) for m in miembros}),
    }


def _secreto(despues: Recurso) -> Recurso:
    return {"etiquetas": _claves_etiquetas(despues.get("labels"))}


def _llave(despues: Recurso) -> Recurso:
    return {
        "periodo_rotacion": despues.get("rotation_period"),
        "etiquetas": _claves_etiquetas(despues.get("labels")),
    }


def _etiquetable(despues: Recurso) -> Recurso:
    return {"etiquetas": _claves_etiquetas(despues.get("labels"))}


_EXTRACTORES: dict[str, Callable[[Recurso], Recurso]] = {
    "google_compute_firewall": _firewall,
    "google_sql_database_instance": _sql,
    "google_compute_instance": _instancia,
    "google_project_iam_member": _iam,
    "google_project_iam_binding": _iam,
    "google_secret_manager_secret": _secreto,
    "google_kms_crypto_key": _llave,
    "google_compute_disk": _etiquetable,
    "google_storage_bucket": _etiquetable,
}


def _campos_sensibles(sensibles: Any) -> list[str]:
    """Nombres de los atributos que Terraform marca como sensibles (sin su valor)."""
    if isinstance(sensibles, dict):
        return sorted(k for k, v in sensibles.items() if v)
    return []


def recurso(cambio: dict[str, Any]) -> Recurso:
    """Vista segura de un ``resource_change`` del plan."""
    tipo = cambio.get("type", "")
    detalle = cambio.get("change") or {}
    despues = detalle.get("after") or {}
    vista: Recurso = {
        "direccion": cambio.get("address"),
        "tipo": tipo,
        "acciones": _lista(detalle.get("actions")),
    }
    extractor = _EXTRACTORES.get(tipo)
    if extractor:
        vista["atributos"] = extractor(despues)
    sensibles = _campos_sensibles(detalle.get("after_sensitive"))
    if sensibles:
        # Se informa QUE existen, para que CO-SEC-01 se pueda explicar, nunca su valor.
        vista["atributos_sensibles_declarados"] = sensibles
    return vista


def plan(plan_json: dict[str, Any]) -> dict[str, Recurso]:
    """Índice dirección -> vista segura, para todos los recursos del plan."""
    return {
        str(c.get("address")): recurso(c)
        for c in plan_json.get("resource_changes") or []
        if c.get("address")
    }
