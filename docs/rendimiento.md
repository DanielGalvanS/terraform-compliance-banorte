# Pruebas de rendimiento

Método, y dónde se anotan los resultados.

> **Sin resultados todavía.** Las pruebas necesitan el ambiente desplegado y
> aún no hay proyecto de GCP. Este documento define el método para que, cuando
> lo haya, solo quede ejecutarlo y llenar las tablas.

## Qué se mide

| Métrica | Herramienta | Objetivo |
| --- | --- | --- |
| Latencia de red | `iperf3` | ≤ 25 ms |
| Throughput | `iperf3` | ≥ 7 Gbps |
| IOPS de almacenamiento | `fio` | ≥ 12 000 |
| Respuesta de Cloud SQL | `pgbench` | ≤ 50 ms |
| Tiempo total de despliegue | `terraform apply` | ≤ 10 min |

Los objetivos son los del prototipo y **hay que validarlos contra la línea
base** en la primera corrida: si resultan irreales para `e2-micro`, se ajustan
y se documenta el cambio.

## Por qué dos instancias

`iperf3` mide entre un cliente y un servidor. Con una sola VM no hay nada que
medir, por eso `environments/dev` levanta `vm-mdc-dev-01` y `vm-mdc-dev-02` en
la misma subred.

La medición es de **ancho de banda intra-VPC**. Si se quisiera latencia entre
zonas, habría que mover una instancia a otra zona y asumir el costo de tráfico
entre zonas.

## Cómo se corren

El reto pide **tres corridas de cada prueba**, para distinguir una medición
real de un pico.

Acceso a las instancias, siempre por IAP, que es la única vía abierta:

```bash
gcloud compute ssh vm-mdc-dev-01 --zone=us-central1-a --tunnel-through-iap
```

### Red

En la instancia 01, como servidor:

```bash
sudo apt-get update && sudo apt-get install -y iperf3
iperf3 --server
```

En la 02, como cliente, tres veces:

```bash
iperf3 --client IP_PRIVADA_DE_01 --time 30 --json > red-corrida-N.json
```

La IP privada sale de `terraform output instancias`.

### Base de datos

Desde cualquiera de las dos, contra la IP privada de Cloud SQL:

```bash
sudo apt-get install -y postgresql-client
pgbench --initialize --scale=10 --host=IP_PRIVADA_SQL --username=USUARIO BASE
pgbench --client=10 --jobs=2 --time=60 --host=IP_PRIVADA_SQL --username=USUARIO BASE
```

La contraseña se lee de Secret Manager, nunca de un archivo:

```bash
gcloud secrets versions access latest --secret=contrasena-sql
```

### Almacenamiento

```bash
sudo apt-get install -y fio
fio --name=lectura --rw=randread --bs=4k --size=1G --numjobs=4 \
    --runtime=60 --group_reporting --output-format=json > iops-corrida-N.json
```

## Resultados

Por llenar tras la primera ejecución.

| Métrica | Corrida 1 | Corrida 2 | Corrida 3 | Media | Objetivo | ¿Cumple? |
| --- | --- | --- | --- | --- | --- | --- |
| Latencia de red | | | | | ≤ 25 ms | |
| Throughput | | | | | ≥ 7 Gbps | |
| IOPS | | | | | ≥ 12 000 | |
| Cloud SQL | | | | | ≤ 50 ms | |
| Despliegue | | | | | ≤ 10 min | |

**Condiciones de la ejecución:** anotar fecha, región, zona, tipo de máquina,
tier de Cloud SQL y si había otra carga en el proyecto. Sin eso, los números no
se pueden comparar entre corridas.

## Destruir y recrear

La prueba de DEV-28 se cronometra con el mismo criterio:

```bash
time terraform destroy -auto-approve
time terraform apply -auto-approve
```

En `dev` la instancia de Cloud SQL no está protegida contra borrado,
precisamente para que esto sea posible. El llavero de KMS y el bucket de
evidencia **sobreviven a propósito**: ver [despliegue.md](despliegue.md).
