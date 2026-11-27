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

## Paso 4: desplegar las aplicaciones

Terraform crea los servicios de Cloud Run con una imagen de ejemplo de Google.
La API y el frontend reales los sube el workflow **Desplegar aplicaciones**
(`.github/workflows/desplegar.yml`):

1. Actions → **Desplegar aplicaciones** → **Run workflow** sobre `main`.
2. El workflow construye las dos imágenes y se pausa en el environment `dev`.
   Al aprobar, las sube a Artifact Registry con el commit como etiqueta y
   despliega primero la API y después el frontend.
3. Al final comprueba que la API responde en `/salud`, que el frontend sirve
   la aplicación y que la API acepta al frontend como origen (CORS). Las URLs
   quedan en el resumen del run.

Antes hay que haber corrido **Aplicar cambios** al menos una vez: sin los
servicios, el workflow se detiene y lo dice.

El despliegue cambia **solo la imagen**. Las variables de entorno, la cuenta
de servicio y el escalado siguen en Terraform; si hace falta cambiarlos, se
cambian en `infra/environments/dev/main.tf`. Volver a una versión anterior es
correr el workflow sobre ese commit, o desde la consola: Cloud Run → el
servicio → Revisiones → mandar el tráfico a la revisión anterior.

**Aplicar cambios** y **Desplegar aplicaciones** comparten un grupo de
concurrencia y nunca corren a la vez. Si corrieran juntos, un plan hecho antes
de un despliegue regresaría la imagen vieja al aplicarse. Terraform no vigila
la imagen (`ignore_changes`), pero al cambiar cualquier otra cosa del servicio
reenvía la que tenía al planear.

## Paso 5: activar el login real

Mientras `login_real` sea `false`, la API desplegada acepta a los usuarios de
demostración con la contraseña pública `demo`. **Cualquiera en internet puede
entrar**, así que este paso no es opcional fuera de una demo.

El orden importa: si la API pasa a Identity Platform antes de que existan los
usuarios y la llave del navegador, nadie puede entrar.

1. **Aplicar cambios** (con `login_real` todavía en `false`). Habilita Identity
   Platform y la API sigue con la demo.
2. Crear los usuarios y la llave del navegador. Lo corre alguien con permisos
   de administrador sobre el proyecto; pide una contraseña por usuario nuevo y
   nunca la escribe en disco:

   ```bash
   cd infra/environments/dev
   PROJECT_ID=TU-PROYECTO WEB_URL="$(terraform output -raw urls_web)" \
     ../../../scripts/identidad/crear_usuarios.sh
   ```

   Crea `compliance@`, `aprobador@`, `desarrollador@` y `auditor@banorte.mx`,
   cada uno con su rol, y la llave `web-login`.
3. Copiar el valor de la llave en la variable de GitHub **`IDP_API_KEY`**
   (Settings → Secrets and variables → Actions → Variables). El script dice
   cómo verlo. Es una variable y no un secreto: termina en el JavaScript
   público, restringida a Identity Platform y a la URL del frontend.
4. Un pull request que cambie `login_real` a `true` en
   `infra/environments/dev/variables.tf`, y **Aplicar cambios**. Desde ese
   momento la API solo acepta tokens de Identity Platform y `/sesion` responde
   404.
5. **Desplegar aplicaciones**, para que el frontend se compile con la llave.
   Entre el paso 4 y este, el frontend desplegado todavía muestra la pantalla
   de demostración y no puede entrar: conviene correrlos seguidos.

Para comprobarlo: entrar con `aprobador@banorte.mx` y ver que `demo` ya no
funciona. Un usuario sin rol puede autenticarse en Identity Platform, pero la
API no le da ningún permiso.

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
| Cloud Run (API y frontend) | Por petición: sin tráfico quedan en cero instancias y no cobran CPU ni memoria |
| Artifact Registry | Por almacenamiento de imágenes. Se conservan las de los últimos 30 días y siempre las 5 más recientes por aplicación |

**Apaga lo que no uses.** El ambiente de dev no necesita estar encendido entre
sesiones de trabajo. Las reglas del equipo para cuidar el crédito están en
[costos.md](costos.md).

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
