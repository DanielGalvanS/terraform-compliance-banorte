# La compuerta de cumplimiento

Cómo se bloquea un cambio de infraestructura que viola un control, y por qué
está diseñada así.

## Quién decide

El bloqueo lo decide **`conftest` evaluando las políticas Rego**, de forma
determinista, dentro del runner. El agente de IA clasifica, explica y propone
remediaciones, pero no puede anular un veredicto.

Esto no es purismo: es lo que hace reproducible la decisión. La misma entrada
produce siempre la misma salida, y esa salida se puede auditar sin preguntarle
a un modelo por qué opinó lo que opinó.

## Por qué corre dentro del runner

La evaluación no llama a ningún servicio externo. Si lo hiciera, un servicio
caído tendría dos salidas posibles, y ambas son malas: dejar pasar los cambios,
o bloquear todo hasta que alguien lo levante.

Corriendo en el runner, la única dependencia es el binario de `conftest`, que se
descarga con versión fija y verificación de integridad. Además mantiene la
validación por debajo de los 5 minutos que exige el reto.

## Los workflows

| Workflow | Cuándo | Qué hace | Necesita GCP |
| --- | --- | --- | --- |
| `validate.yml` | Todo PR | `terraform fmt` y `validate` | No |
| `policies.yml` | Todo PR | Prueba el catálogo, lo ejerce contra los planes de ejemplo y comprueba que las pantallas concuerdan con él | No |
| `aplicaciones.yml` | Todo PR | Tipos, pruebas y build del frontend y la API | No |
| `secretos.yml` | Todo PR | Escaneo de secretos con gitleaks | No |
| `plan.yml` | PR que toca `infra/` | `terraform plan` real, veredicto y comentario en el PR | Sí |
| `apply.yml` | A mano, por ambiente | Plan, aprobación humana y despliegue | Sí |
| `drift.yml` | Cada hora y a mano | Compara la nube con `main` y falla si no coinciden (drift) | Sí |

`plan.yml` se salta solo mientras no exista la variable
`GCP_WORKLOAD_IDENTITY_PROVIDER`. Así el repositorio no se llena de ejecuciones
en rojo antes de tener proyecto.

## Falla segura

`policy_check.sh` escribe `veredicto.json` con uno de tres resultados:

- `conforme` — ninguna violación. Código de salida 0.
- `bloqueado` — al menos una violación. Código 1.
- `error` — el evaluador no pudo emitir un juicio. Código 1 o 2.

**El tercero es el importante.** Si `conftest` no está instalado, el plan no se
puede leer o el proceso muere a mitad, el resultado es `error` y el despliegue
se bloquea igual que con una violación. Un evaluador que no puede opinar nunca
autoriza. Es el caso de prueba CP-15, y `policies.yml` lo ejercita en cada
ejecución.

## Lo que falta configurar en GitHub

### Protección de la rama `main`

Sin esto los workflows informan pero no bloquean nada. En
**Settings → Branches → Add branch protection rule** (o **Rules → Rulesets**)
sobre `main`:

- Require a pull request before merging, con **1 aprobación**.
  - Dismiss stale pull request approvals when new commits are pushed.
  - *Require review from Code Owners* queda **apagado**. `CODEOWNERS` solo
    sirve para pedir revisión automáticamente.
- Require status checks to pass before merging.
  - Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Do not allow bypassing the above settings: el dueño del repo también pasa
  por PR.
- Force pushes y borrado de la rama, apagados.

**Checks obligatorios.** Son los `name:` de los jobs y se escriben
exactamente así:

| Check | Workflow |
| --- | --- |
| `Formato` | `validate.yml` |
| `Sintaxis` | `validate.yml` |
| `Pruebas del catálogo` | `policies.yml` |
| `Compuerta sobre los planes de ejemplo` | `policies.yml` |
| `El frontend concuerda con el catálogo` | `policies.yml` |
| `Tipos, pruebas y build` | `aplicaciones.yml` |
| `Escaneo del repositorio` | `secretos.yml` |

`Plan y veredicto del ambiente dev` **no** es obligatorio: necesita GCP y se
salta mientras no exista el proyecto.

#### Por qué los checks corren en todo PR

Un check obligatorio cuyo workflow no corre se queda en *Expected — Waiting
for status to be reported* para siempre, y el PR no se puede fusionar. Si
`validate.yml` solo corriera en PR que tocan `infra/`, un PR que solo cambie
`apps/` quedaría bloqueado.

Por eso los cuatro workflows obligatorios no tienen filtro de rutas en
`pull_request`. Los filtros de `push` a `main` se conservan. El costo es que
cada PR corre los cuatro, unos 2–4 minutos en paralelo.

Si se agrega un check obligatorio nuevo, su workflow tampoco debe filtrar
rutas en `pull_request`.

#### Quién cambia la regla

Los cambios a la regla los hace **solo el dueño del repo** (`DanielGalvanS`).
Cualquier cambio —agregar o quitar un check, cambiar el número de
aprobaciones— se acuerda con el equipo y se documenta aquí.

### Workload Identity Federation

`plan.yml` y `apply.yml` se autentican en GCP sin llaves: el runner cambia su
token OIDC de GitHub por credenciales temporales. Todo lo que eso necesita en
GCP lo crea un script de arranque. Mientras no se corra, `plan.yml` se salta
solo.

#### 1. Correr el script de arranque

Lo corre **una vez** quien tenga rol **Owner** en el proyecto, el día que el
proyecto exista, con `gcloud` autenticado como esa persona:

```bash
# Primero, ver qué haría sin tocar nada:
PROJECT_ID=mi-proyecto scripts/bootstrap/gcp_pipeline.sh --simular

# Después, de verdad:
PROJECT_ID=mi-proyecto scripts/bootstrap/gcp_pipeline.sh
```

`REGION` (por defecto `us-central1`) y `REPO` (por defecto este repositorio)
son opcionales. El script es idempotente: si algo ya existe lo dice y sigue,
así que se puede volver a correr para agregar un permiso.

Qué crea:

| Recurso | Para qué |
| --- | --- |
| APIs `iam`, `iamcredentials`, `sts`, `cloudresourcemanager`, `storage`, `serviceusage` | Las que necesita el arranque |
| Bucket `gs://<proyecto>-tfstate` | Estado de Terraform. Versionado, acceso uniforme y sin acceso público |
| Cuenta `ci-plan` | Solo lectura: `roles/viewer`, `roles/iam.securityReviewer` y escritura **solo** en el bucket del estado, para el lock |
| Cuenta `ci-apply` | Escritura. La lista de roles está en el script y se ajusta en el primer apply real. Nunca `roles/owner` |
| Pool `github` y proveedor OIDC `github` | Solo acepta tokens de **este** repositorio (`attribute-condition`) |

Quién puede usar cada cuenta:

- **`ci-plan`:** cualquier job del repositorio, incluidos los de pull request.
- **`ci-apply`:** **solo** jobs que corren dentro del environment `dev` de
  GitHub, es decir, los que pasaron por su aprobación. Un pull request
  cualquiera no puede obtener la cuenta de escritura, aunque alguien edite el
  workflow para pedirla.

El script **nunca** crea llaves JSON de cuenta de servicio. Tampoco se deben
crear a mano ni guardar como secret de GitHub.

#### 2. Pegar las variables en GitHub

Al terminar, el script imprime los valores. Van en **Settings → Secrets and
variables → Actions → Variables**:

| Variable | Ejemplo | Para qué | La imprime el script |
| --- | --- | --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/123/locations/global/workloadIdentityPools/github/providers/github` | Proveedor OIDC. Si no existe, `plan.yml` se salta | Sí |
| `GCP_SERVICE_ACCOUNT_PLAN` | `ci-plan@mdc-dev-123.iam.gserviceaccount.com` | Cuenta del plan | Sí |
| `GCP_SERVICE_ACCOUNT_APPLY` | `ci-apply@mdc-dev-123.iam.gserviceaccount.com` | Cuenta del apply | Sí |
| `GCP_PROJECT_ID` | `mdc-dev-123` | `TF_VAR_project_id` | Sí |
| `TF_STATE_BUCKET` | `mdc-dev-123-tfstate` | Backend (`prefix=mdc/dev`, el mismo que en local) | Sí |
| `BUCKET_EVIDENCIA` | `mdc-dev-123-evidencia` | `TF_VAR_bucket_evidencia` | No |
| `CENTRO_COSTOS` | `cc-0001` | `TF_VAR_centro_costos` | No |
| `CUENTA_FACTURACION` | opcional | `TF_VAR_cuenta_facturacion` (presupuesto de DEV-16) | No |
| `CORREOS_ALERTAS_COSTO` | opcional, JSON: `["a@x.com"]` | `TF_VAR_correos_alertas_costo` | No |

Son *variables*, no *secrets*: ninguno de los valores es una credencial. La
credencial es el token OIDC que GitHub emite en cada ejecución y que caduca
sola.

Si falta una obligatoria, el primer paso de los jobs, **Comprobar
configuración**, falla y dice cuál. Las opcionales solo se pasan a Terraform
si tienen valor: una variable de GitHub que no existe vale cadena vacía, y
`""` no es lo mismo que `null` para Terraform.

#### 3. Crear el environment `dev`

En **Settings → Environments → New environment**, con el nombre `dev`
exacto. GCP solo entrega `ci-apply` a jobs de ese environment, así que sin él
`apply.yml` no puede aplicar.

#### 4. Qué esperar en el primer PR

El job **Plan y veredicto del ambiente dev** deja de saltarse: hace el
`terraform plan` real, lo somete a la compuerta y comenta el veredicto en el
PR. Sigue sin ser un check obligatorio de `main`.

Si algo da `403`, falta un rol: se agrega en el script, se vuelve a correr y se
anota aquí.

## El despliegue: por qué no se vuelve a planear

`apply.yml` tiene dos trabajos. El primero planea y pasa la compuerta; el
segundo aplica. Entre los dos se interpone el *environment* de GitHub, que es
donde esperan los revisores.

El segundo trabajo **no vuelve a planear**. Descarga el archivo de plan que ya
pasó la compuerta y lo aplica tal cual.

La razón es que el estado de la nube pudo cambiar entre la aprobación y el
despliegue. Si se replaneara, se aplicaría un plan que nadie revisó —puede
incluir recursos nuevos, o destruir algo que apareció en medio—. Aplicar el
archivo guardado es lo que hace que la aprobación signifique algo.

### La huella

El trabajo que planea calcula el SHA-256 del plan y lo publica como salida. El
que aplica lo recalcula sobre el archivo descargado y se niega a continuar si
no coincide. Si alguien sustituyera el artefacto entre la aprobación y el
despliegue, el apply se detiene.

### Verificación posterior

Después del apply se corre `terraform plan -detailed-exitcode`. Un plan vacío
significa que la nube quedó como dice el código. Cualquier diferencia es drift
inmediato y el despliegue se marca como fallido.

## Drift cada hora

`drift.yml` repite esa misma verificación cada hora (minuto 17) sobre `dev`,
con `ci-plan`, de solo lectura. Cubre RF-03 del reto. Nunca corrige nada: si
la nube no coincide con `main`, la corrida falla, el resumen lista los recursos
y el reporte queda como artefacto (`drift-reporte.json`, 90 días).

| Resultado | Qué significa | Qué hacer |
| --- | --- | --- |
| ✅ Sin drift | La nube es lo que dice `main` | Nada |
| ⛔ Drift | Alguien cambió algo a mano, o hay un PR de infra fusionado sin aplicar | Revertir con **Aplicar cambios**, o llevar el cambio a un PR si es correcto |
| ⚠️ Error | El plan no corrió (por ejemplo, el estado bloqueado por un apply en curso) | Volver a correrlo; no dice nada sobre drift |

Decisiones:

- **Plan normal, no `-refresh-only`.** El plan normal respeta los
  `ignore_changes` de los módulos. Con `-refresh-only`, cada despliegue de
  Cloud Run (que cambia la imagen fuera de Terraform) saldría como drift.
- **Un PR fusionado sin aplicar cuenta como drift.** `main` es la fuente de
  verdad; mientras la nube no la refleje, hay una diferencia que reportar.
- **No detecta recursos creados a mano que Terraform no administra.** Solo
  vigila lo que está en el estado. Por eso la regla del equipo es que nada se
  crea en la consola.
- GitHub puede retrasar los `schedule` varios minutos y apaga los programados
  tras 60 días sin actividad en el repositorio.

### Probarlo

1. **Actions → Drift → Run workflow**: debe salir ✅ sin drift.
2. Cambiar algo a mano en la consola sobre un recurso administrado, por
   ejemplo agregar una etiqueta a `vm-mdc-dev-01` (Compute Engine → la VM →
   Editar → Etiquetas).
3. **Run workflow** otra vez, o esperar a la siguiente hora: debe salir ⛔ y
   listar `module.compute.google_compute_instance.estas["vm-mdc-dev-01"]`.
4. Revertir con **Aplicar cambios** y comprobar que la siguiente corrida vuelve
   a ✅.

## El frontend también se comprueba

`policies.yml` incluye un trabajo que cruza las pantallas con el catálogo:

- Los marcos que muestra el frontend son exactamente los de `mappings.yaml`.
- Ningún dato de ejemplo cita un marco fuera de alcance.
- Todo control `CO-XX-NN` que aparece en pantalla existe en el catálogo.
- Las etiquetas obligatorias del inventario son las que exige CO-TAG-01.

Sin esto, el producto puede acabar enseñando una cobertura que las políticas no
respaldan —ocurrió: el tablero graficaba seis marcos cuando solo tres estaban
en alcance— y no se nota leyendo el código, porque cada archivo es coherente
consigo mismo.

Se ejecuta en local con:

```bash
python3 scripts/verificar_catalogo.py
```

## Los environments de GitHub

Los revisores obligatorios se configuran en **Settings → Environments**, no en
el archivo del workflow. Es deliberado: un revisor que se pudiera quitar con un
commit no sería un control.

| Environment | Revisores | Por qué |
| --- | --- | --- |
| `dev` | Ninguno | Severidad baja y media se auto-aprueban |
| `qa` | 1 | Cambios revisados antes de la validación formal |
| `produccion` | 2 | Producción nunca se aplica sin aprobación humana |

Hoy `apply.yml` solo ofrece `dev`: `infra/environments/qa` y `prod` están
vacíos. `qa` y `produccion` se reactivan cuando tengan configuración y su
propia cuenta de apply.

En `produccion` conviene además marcar *Prevent self-review*, para que quien
lanza el despliegue no pueda aprobarse a sí mismo.

### Variables adicionales

| Variable | Contenido |
| --- | --- |
| `GCP_SERVICE_ACCOUNT_APPLY` | `ci-apply`, con permisos de escritura, usada solo por `apply.yml` |

La cuenta del plan es de solo lectura y la del apply es distinta: así un fallo
en el workflow de validación no puede modificar nada.
