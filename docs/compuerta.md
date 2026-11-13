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

## Los tres workflows

| Workflow | Cuándo | Qué hace | Necesita GCP |
| --- | --- | --- | --- |
| `validate.yml` | PR que toca `infra/` | `terraform fmt` y `validate` | No |
| `policies.yml` | PR que toca `infra/` | Prueba el catálogo y lo ejerce contra los planes de ejemplo | No |
| `plan.yml` | PR que toca `infra/` | `terraform plan` real, veredicto y comentario en el PR | Sí |

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
**Settings → Branches → Add rule** sobre `main`:

- Require a pull request before merging.
- Require status checks to pass: `Formato`, `Sintaxis`, `Pruebas del catálogo`
  y `Compuerta sobre los planes de ejemplo`.
- Require branches to be up to date before merging.
- Do not allow bypassing the above settings.

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
