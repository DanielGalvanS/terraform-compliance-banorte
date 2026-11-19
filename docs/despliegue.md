# Despliegue

Cómo levantar el ambiente desde cero, y cómo destruirlo.

> **Nada de esto se ha ejecutado todavía contra GCP.** No hay proyecto, así que
> los módulos están validados sintácticamente pero su compatibilidad real con
> la API de Google está sin comprobar. Espera fricción la primera vez.

## Antes de empezar

| Requisito | Por qué |
| --- | --- |
| Proyecto de GCP con facturación activa | Cloud SQL y Cloud NAT no tienen capa gratuita |
| Permisos de administrador en el proyecto | Hay que habilitar APIs y crear cuentas de servicio |
| `terraform` ≥ 1.9 | Versión fijada en los módulos |
| `conftest` 0.71.1 | Para correr la compuerta en local |
| `gcloud` autenticado | `gcloud auth application-default login` |
| Rol `roles/billing.costsManager` en la cuenta de facturación | El módulo `costos` crea el presupuesto en la cuenta, no en el proyecto. Opcional: sin `cuenta_facturacion` el presupuesto no se crea |

## Paso 1: el bucket del estado

Es el huevo y la gallina del estado remoto: Terraform necesita un bucket que
Terraform todavía no puede crear. **Lo crea el script de arranque**, junto con
las identidades del pipeline:

```bash
PROJECT_ID=TU-PROYECTO scripts/bootstrap/gcp_pipeline.sh
```

Crea `gs://TU-PROYECTO-tfstate` con versionado, acceso uniforme y sin acceso
público. Se corre una vez; el detalle está en
[compuerta.md](compuerta.md#workload-identity-federation).

## Paso 2: configurar el ambiente

```bash
cd infra/environments/dev
cp terraform.tfvars.example terraform.tfvars
cp backend.tfbackend.example backend.tfbackend
```

Rellena ambos con los valores reales. **Ninguno de los dos se versiona**: están
en `.gitignore` y deben seguir ahí.

## Paso 3: desplegar

```bash
terraform init -backend-config=backend.tfbackend
terraform plan -out=plan.bin

# La misma compuerta que corre en el pipeline, antes de aplicar nada.
terraform show -json plan.bin > plan.json
../../pipelines/scripts/policy_check.sh plan.json

terraform apply plan.bin
```

Si `policy_check.sh` devuelve algo distinto de `conforme`, **no apliques**:
corrige lo que señale el veredicto.

La primera ejecución tarda varios minutos. Cloud SQL es lo más lento, entre 5 y
10 minutos.

## Lo que cuesta

No pongo cifras porque los precios cambian y prefiero no inventarlas. Usa la
[calculadora de Google](https://cloud.google.com/products/calculator) con estos
datos, que son los que mueven la factura:

| Recurso | Impacto |
| --- | --- |
| Cloud SQL `db-g1-small` | El gasto continuo principal. Sin capa gratuita |
| Cloud NAT | Cobra por hora activa y por datos procesados |
| 2 × `e2-micro` | En `us-central1` una entra en la capa gratuita; la segunda no |
| KMS | Por llave activa y por operación. Marginal |
| Bucket de evidencia | Por almacenamiento. Marginal al principio |

**Apaga lo que no uses.** El ambiente de dev no necesita estar encendido entre
sesiones de trabajo.

### Presupuesto y avisos

El módulo [`costos`](../infra/modules/costos/README.md) crea un presupuesto
mensual del proyecto (50 USD por defecto en dev, variable
`presupuesto_mensual`) que manda correo a `correos_alertas_costo`:

| Aviso | Cuándo llega | Qué hacer |
| --- | --- | --- |
| 50 % del gasto real | A mitad del presupuesto | Revisar que no haya quedado nada encendido |
| 80 % del gasto real | Cerca del límite | Destruir dev en cuanto termine la sesión |
| 100 % del gasto real | Presupuesto agotado | Destruir dev ya y avisar al equipo |
| Pronóstico ≥ 100 % | GCP prevé que el mes cerrará por encima | Igual que el 80 % |

**El presupuesto no apaga nada.** GCP solo avisa; el gasto sigue corriendo hasta
que alguien destruye los recursos. La regla del equipo es la de abajo: cada
sesión termina con `terraform destroy`.

## Destruir el ambiente

```bash
cd infra/environments/dev
terraform destroy
```

Tres cosas **no** se van a borrar, y es a propósito:

| Recurso | Por qué sobrevive |
| --- | --- |
| Llavero de KMS | GCP no permite borrarlo. `prevent_destroy` evita el engaño de sacarlo del estado mientras sigue existiendo |
| Bucket de evidencia | `prevent_destroy`. La evidencia debe sobrevivir al ambiente que la produjo |
| APIs habilitadas | `disable_on_destroy = false`: apagarlas afectaría a otros recursos del proyecto |

La instancia de Cloud SQL **sí** se borra en `dev`, porque
`proteger_contra_borrado = false`. Es lo que necesita la prueba de destruir y
recrear. En producción una precondición impide desactivarlo.

Para quitar de verdad el llavero o el bucket hay que editar el módulo y quitar
el `prevent_destroy`. Es intencional: así nadie los borra por accidente.

## Configurar el pipeline

Lo que falta en GitHub —protección de rama, Workload Identity Federation y los
environments con revisores— está en [compuerta.md](compuerta.md).
