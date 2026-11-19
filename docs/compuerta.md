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

Para que `plan.yml` se autentique sin llaves hay que crear un pool de identidad
y un proveedor OIDC en GCP, y una cuenta de servicio de **solo lectura** para el
plan. Después, en **Settings → Secrets and variables → Actions → Variables**:

| Variable | Contenido |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Ruta completa del proveedor OIDC |
| `GCP_SERVICE_ACCOUNT_PLAN` | Correo de la cuenta de servicio del plan |

Son *variables*, no *secrets*: ninguno de los dos valores es una credencial.
La credencial es el token OIDC que GitHub emite en cada ejecución y que caduca
sola.

**Nunca** se debe guardar un archivo JSON de cuenta de servicio como secret.


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

En `produccion` conviene además marcar *Prevent self-review*, para que quien
lanza el despliegue no pueda aprobarse a sí mismo.

### Variables adicionales

| Variable | Contenido |
| --- | --- |
| `GCP_SERVICE_ACCOUNT_APPLY` | Cuenta con permisos de escritura, usada solo por `apply.yml` |

La cuenta del plan es de solo lectura y la del apply es distinta: así un fallo
en el workflow de validación no puede modificar nada.
