"""Pruebas de resumir.py con salidas reales recortadas de cada herramienta.

    python3 -m unittest discover -s scripts/rendimiento
"""

import json
import tempfile
import unittest
from pathlib import Path

import resumir

PING = """--- 10.10.1.2 ping statistics ---
20 packets transmitted, 20 received, 0% packet loss, time 3805ms
rtt min/avg/max/mdev = 0.211/{avg}/0.612/0.081 ms
"""

PGBENCH = """transaction type: <builtin: TPC-B (sort of)>
number of clients: 10
latency average = {lat} ms
tps = 512.3 (without initial connection time)
"""


def iperf3(bps: float) -> str:
    return json.dumps({"end": {"sum_received": {"bits_per_second": bps}}})


def fio(iops: float) -> str:
    return json.dumps({"jobs": [{"read": {"iops": iops}}]})


class Resumir(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.carpeta = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def escribir(self, nombre: str, contenido: str):
        (self.carpeta / nombre).write_text(contenido)

    def fila(self, nombre: str) -> list[str]:
        for linea in resumir.tabla(self.carpeta).splitlines():
            celdas = [c.strip() for c in linea.strip("|").split("|")]
            if celdas[0] == nombre:
                return celdas
        self.fail(f"no hay fila {nombre}")

    def test_tres_corridas_que_cumplen(self):
        for n, avg in enumerate(["0.30", "0.40", "0.50"], start=1):
            self.escribir(f"latencia-corrida-{n}.txt", PING.format(avg=avg))
        self.assertEqual(self.fila("Latencia de red"), ["Latencia de red", "0.3", "0.4", "0.5", "0.4", "≤ 25 ms", "Sí"])

    def test_throughput_en_gbps_y_bajo_objetivo(self):
        for n in range(1, 4):
            self.escribir(f"red-corrida-{n}.json", iperf3(1.5e9))
        celdas = self.fila("Throughput")
        self.assertEqual(celdas[4], "1.5")
        self.assertEqual(celdas[6], "No")

    def test_iops_y_pgbench(self):
        for n in range(1, 4):
            self.escribir(f"iops-corrida-{n}.json", fio(15000))
            self.escribir(f"sql-corrida-{n}.txt", PGBENCH.format(lat="19.52"))
        self.assertEqual(self.fila("IOPS")[4:], ["15 000", "≥ 12 000", "Sí"])
        # Sin unidad no debe quedar un espacio colgando en la celda.
        self.assertIn("| ≥ 12 000 |", resumir.tabla(self.carpeta))
        self.assertEqual(self.fila("Cloud SQL")[4:], ["19.52", "≤ 50 ms", "Sí"])

    def test_despliegue_en_minutos(self):
        for n, segundos in enumerate(["420", "480", "540"], start=1):
            self.escribir(f"despliegue-corrida-{n}.txt", segundos + "\n")
        self.assertEqual(self.fila("Despliegue")[1:5], ["7", "8", "9", "8"])

    def test_faltan_corridas(self):
        self.escribir("iops-corrida-1.json", fio(20000))
        self.assertEqual(self.fila("IOPS")[-1], "Incompleto (1 de 3)")

    def test_sin_datos_deja_la_fila_vacia(self):
        self.assertEqual(self.fila("Cloud SQL")[1:5], ["", "", "", ""])

    def test_iperf3_con_error_falla_en_voz_alta(self):
        self.escribir("red-corrida-1.json", json.dumps({"error": "unable to connect to server"}))
        with self.assertRaisesRegex(ValueError, "unable to connect"):
            resumir.tabla(self.carpeta)

    def test_ping_de_macos(self):
        self.escribir("latencia-corrida-1.txt", "round-trip min/avg/max/stddev = 1.0/2.5/4.0/0.3 ms\n")
        self.assertEqual(self.fila("Latencia de red")[1], "2.5")


if __name__ == "__main__":
    unittest.main()
