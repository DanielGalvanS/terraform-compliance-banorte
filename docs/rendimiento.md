# Pruebas de rendimiento

Método, y dónde se anotan los resultados.

> **Sin resultados todavía.** Las pruebas necesitan el ambiente desplegado y
> aún no hay proyecto de GCP. Este documento define el método para que, cuando
> lo haya, solo quede ejecutarlo y llenar las tablas.

## Qué se mide

| Métrica | Herramienta | Objetivo |
| --- | --- | --- |
| Latencia de red | `ping` | ≤ 25 ms |
| Throughput | `iperf3` | ≥ 7 Gbps |
| IOPS de almacenamiento | `fio` | ≥ 12 000 |
| Respuesta de Cloud SQL | `pgbench` | ≤ 50 ms |
| Tiempo total de despliegue | `terraform apply` | ≤ 10 min |

Los objetivos son los del prototipo y **hay que validarlos contra la línea
base** en la primera corrida: si resultan irreales para `e2-micro`, se ajustan
y se documenta el cambio.

**Expectativa honesta para dev.** Según la documentación de GCP, una `e2-micro`
tiene un tope de salida del orden de 1 Gbps y un disco `pd-balanced` de 20 GB
ronda las 3 000 IOPS. Es probable que throughput e IOPS queden por debajo del
objetivo con estas máquinas. Si pasa, se reporta tal cual y se propone el tipo
de máquina que sí lo alcanzaría; no se maquillan los números.

## Por qué dos instancias

`iperf3` mide entre un cliente y un servidor. Con una sola VM no hay nada que
medir, por eso `environments/dev` levanta `vm-mdc-dev-01` y `vm-mdc-dev-02` en
la misma subred.

La medición es de **ancho de banda intra-VPC**. Si se quisiera latencia entre
zonas, habría que mover una instancia a otra zona y asumir el costo de tráfico
entre zonas.

## Cómo se corren

El reto pide **tres corridas de cada prueba**, para distinguir una medición
real de un pico. Los scripts de [`scripts/rendimiento`](../scripts/rendimiento)
hacen las tres, guardan los resultados crudos en `~/resultados-rendimiento` y
anotan las condiciones de la ejecución (fecha, zona, tipo de máquina).

El firewall de dev ya permite lo que necesitan: el puerto 5201 de `iperf3` y
ICMP, ambos solo dentro de la subred.

### 1. Copiar los scripts a las instancias

Las VMs no tienen el repositorio. Se copian por IAP, que es la única vía abierta:

```bash
for vm in vm-mdc-dev-01 vm-mdc-dev-02; do
  gcloud compute scp --recurse scripts/rendimiento "${vm}":~ \
    --zone=us-central1-a --tunnel-through-iap
done
gcloud compute ssh vm-mdc-dev-01 --zone=us-central1-a --tunnel-through-iap
```

Cada script instala lo que le falte (`iperf3`, `fio`, `postgresql-client`).

### 2. Red

En `vm-mdc-dev-01`, como servidor:

```bash
~/rendimiento/red.sh servidor
```

En `vm-mdc-dev-02`, como cliente. La IP privada sale de
`terraform output instancias`:

```bash
~/rendimiento/red.sh cliente IP_PRIVADA_DE_01
```

Mide primero la latencia con `ping`, en reposo, y luego el throughput con
`iperf3` y 4 flujos en paralelo: un solo flujo TCP no llena el enlace.

### 3. Almacenamiento

En cualquiera de las dos:

```bash
~/rendimiento/disco.sh
```

Lectura aleatoria de 4 KB con I/O directo. Sin `--direct=1`, `fio` mediría la
caché de páginas en RAM y daría un número que el disco no tiene.

### 4. Base de datos

Contra la IP privada de Cloud SQL (`terraform output sql_ip_privada`):

```bash
~/rendimiento/sql.sh IP_PRIVADA_SQL USUARIO
```

Pide la contraseña por teclado; nunca se escribe a un archivo. Se obtiene
desde tu equipo, porque la cuenta de servicio de las VMs no puede leer el
secreto:

```bash
gcloud secrets versions access latest --secret=contrasena-sql
```

### 5. Resumir

Se traen los resultados y se genera la tabla de abajo:

```bash
gcloud compute scp --recurse vm-mdc-dev-02:~/resultados-rendimiento . \
  --zone=us-central1-a --tunnel-through-iap
python3 scripts/rendimiento/resumir.py resultados-rendimiento
```

Si faltan corridas, la columna «¿Cumple?» dice «Incompleto» en vez de dar la
media por buena.

## Resultados

Por llenar tras la primera ejecución, con la salida de `resumir.py`.

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
terraform destroy -auto-approve
inicio=$(date +%s); terraform apply -auto-approve
echo $(( $(date +%s) - inicio )) > resultados-rendimiento/despliegue-corrida-1.txt
```

Tres veces, cambiando el número de corrida. `resumir.py` lo convierte a minutos
y llena la fila «Despliegue».

En `dev` la instancia de Cloud SQL no está protegida contra borrado,
precisamente para que esto sea posible. El llavero de KMS y el bucket de
evidencia **sobreviven a propósito**: ver [despliegue.md](despliegue.md).
