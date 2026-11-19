#!/usr/bin/env python3
"""Resume los resultados crudos de las pruebas de rendimiento.

Lee la carpeta que dejan red.sh, disco.sh y sql.sh y escribe la tabla de
docs/rendimiento.md: una fila por métrica, con cada corrida, la media, el
objetivo y si se cumple.

    python3 scripts/rendimiento/resumir.py ~/resultados-rendimiento

El tiempo de despliegue no lo mide ningún script de la VM: se cronometra en el
equipo que corre Terraform y se guarda en segundos, un archivo por corrida:

    inicio=$(date +%s); terraform apply plan.bin
    echo $(( $(date +%s) - inicio )) > despliegue-corrida-1.txt

Solo usa la biblioteca estándar, para correr en la VM sin instalar nada.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Callable, Optional


@dataclass(frozen=True)
class Metrica:
    nombre: str
    patron: str  # glob de los archivos de cada corrida
    leer: Callable[[Path], float]
    unidad: str
    objetivo: float
    mayor_es_mejor: bool

    def cumple(self, valor: float) -> bool:
        return valor >= self.objetivo if self.mayor_es_mejor else valor <= self.objetivo

    def objetivo_texto(self) -> str:
        signo = "≥" if self.mayor_es_mejor else "≤"
        texto = f"{signo} {formatear(self.objetivo)}"
        return f"{texto} {self.unidad}" if self.unidad else texto


def latencia_ping(archivo: Path) -> float:
    """Media del rtt en ms. Linux escribe «rtt», macOS «round-trip»."""
    texto = archivo.read_text()
    encontrado = re.search(r"(?:rtt|round-trip) [^=]+= [\d.]+/([\d.]+)/", texto)
    if not encontrado:
        raise ValueError(f"{archivo.name}: no hay resumen de ping")
    return float(encontrado.group(1))


def throughput_iperf3(archivo: Path) -> float:
    """Lo recibido por el servidor, en Gbps: es lo que de verdad cruzó la red."""
    datos = json.loads(archivo.read_text())
    if "error" in datos:
        raise ValueError(f"{archivo.name}: iperf3 falló: {datos['error']}")
    return datos["end"]["sum_received"]["bits_per_second"] / 1e9


def iops_fio(archivo: Path) -> float:
    datos = json.loads(archivo.read_text())
    # Con --group_reporting, fio junta todos los trabajos en el primero.
    return float(datos["jobs"][0]["read"]["iops"])


def latencia_pgbench(archivo: Path) -> float:
    encontrado = re.search(r"latency average = ([\d.]+) ms", archivo.read_text())
    if not encontrado:
        raise ValueError(f"{archivo.name}: pgbench no reportó latencia")
    return float(encontrado.group(1))


def minutos_despliegue(archivo: Path) -> float:
    return float(archivo.read_text().strip()) / 60


METRICAS = [
    Metrica("Latencia de red", "latencia-corrida-*.txt", latencia_ping, "ms", 25, False),
    Metrica("Throughput", "red-corrida-*.json", throughput_iperf3, "Gbps", 7, True),
    Metrica("IOPS", "iops-corrida-*.json", iops_fio, "", 12000, True),
    Metrica("Cloud SQL", "sql-corrida-*.txt", latencia_pgbench, "ms", 50, False),
    Metrica("Despliegue", "despliegue-corrida-*.txt", minutos_despliegue, "min", 10, False),
]


def formatear(valor: float) -> str:
    if valor >= 1000:
        return f"{valor:,.0f}".replace(",", " ")
    return f"{valor:.2f}".rstrip("0").rstrip(".")


def numero_de_corrida(archivo: Path) -> int:
    return int(re.search(r"corrida-(\d+)", archivo.name).group(1))


def fila(metrica: Metrica, carpeta: Path, corridas: int) -> list[str]:
    archivos = sorted(carpeta.glob(metrica.patron), key=numero_de_corrida)
    valores: dict[int, float] = {numero_de_corrida(a): metrica.leer(a) for a in archivos}

    celdas = [formatear(valores[n]) if n in valores else "" for n in range(1, corridas + 1)]
    media: Optional[float] = mean(valores.values()) if valores else None

    if media is None:
        resultado, cumple = "", ""
    else:
        resultado = formatear(media)
        # Con menos corridas de las pedidas la media no vale como resultado.
        if len(valores) < corridas:
            cumple = f"Incompleto ({len(valores)} de {corridas})"
        else:
            cumple = "Sí" if metrica.cumple(media) else "No"

    return [metrica.nombre, *celdas, resultado, metrica.objetivo_texto(), cumple]


def tabla(carpeta: Path, corridas: int = 3) -> str:
    encabezado = ["Métrica", *[f"Corrida {n}" for n in range(1, corridas + 1)], "Media", "Objetivo", "¿Cumple?"]
    filas = [encabezado, ["---"] * len(encabezado)]
    filas += [fila(m, carpeta, corridas) for m in METRICAS]
    return "\n".join("| " + " | ".join(f) + " |" for f in filas)


def main(argumentos: list[str]) -> int:
    if len(argumentos) != 1:
        print(__doc__.strip().splitlines()[0], file=sys.stderr)
        print(f"uso: {Path(sys.argv[0]).name} CARPETA_DE_RESULTADOS", file=sys.stderr)
        return 2

    carpeta = Path(argumentos[0]).expanduser()
    if not carpeta.is_dir():
        print(f"error: {carpeta} no es una carpeta", file=sys.stderr)
        return 1

    print(tabla(carpeta))
    condiciones = carpeta / "condiciones.txt"
    if condiciones.exists():
        print("\n**Condiciones de la ejecución:**\n")
        print("\n".join(f"- {linea}" for linea in condiciones.read_text().splitlines()))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
