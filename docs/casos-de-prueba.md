# Casos de prueba y su evidencia

Dónde se demuestra cada caso del reto, y con qué se comprueba.

| Caso | Qué exige | Estado | Dónde se demuestra |
| --- | --- | --- | --- |
| CP-05 | Firewall con 0.0.0.0/0 al 22 es rechazado | **Cubierto** | `CO-NET-01` |
| CP-06 | Cloud SQL con IP pública es rechazado | **Cubierto** | `CO-DB-01` |
| CP-07 | Cloud SQL sin CMEK es rechazado | **Cubierto** | `CO-DB-02` |
| CP-08 | Un pull request conforme es aprobado | **Cubierto** | `plan_conforme.json` |
| CP-09 | Un secreto en el código falla el pull request | **PENDIENTE** | Ver abajo |
| CP-15 | Si falla el evaluador, el pipeline bloquea | **Cubierto** | `policy_check.sh` |
| CP-16 | Un recurso sin etiquetas es rechazado | **Cubierto** | `CO-TAG-01` |
| CP-17 | El agente no puede aprobar un PR bloqueado | **Estructural** | Ver abajo |

## Cómo reproducirlos

Todos menos CP-09 se comprueban sin proyecto de GCP:

```bash
# Las políticas se prueban a sí mismas: 32 pruebas unitarias.
conftest verify --policy infra/policies/rego

# CP-08: el plan conforme pasa los ocho controles.
infra/pipelines/scripts/policy_check.sh infra/policies/fixtures/plan_conforme.json

# CP-05, CP-06, CP-07, CP-16: el plan con violaciones se bloquea.
infra/pipelines/scripts/policy_check.sh infra/policies/fixtures/plan_violaciones.json

# CP-15: una entrada ilegible produce veredicto 'error', nunca 'conforme'.
echo 'no es un plan' > /tmp/corrupto.json
infra/pipelines/scripts/policy_check.sh /tmp/corrupto.json
```

El workflow `policies.yml` corre estos mismos casos en cada pull request, así
que no son una comprobación que alguien hizo una vez: se repiten solas.

## CP-09 está pendiente

**No hay escaneo de secretos en el pipeline.** Nada impide hoy que alguien suba
una contraseña o una llave en un archivo de Terraform.

Lo que falta es añadir un paso de escaneo a `validate.yml` —gitleaks o
similar— y un fixture con un secreto incrustado que demuestre el rechazo. Es
trabajo de media hora y es el único caso de prueba del reto sin cubrir.

Las convenciones ya empujan en la dirección correcta: el módulo `secrets` no
acepta valores, y `.gitignore` excluye `*.tfvars` y `*.tfbackend`. Pero una
convención no es un control: no bloquea nada.

## CP-17 es estructural

El agente todavía no existe, así que no se puede demostrar que *no puede*
aprobar un pull request bloqueado. Lo que sí está construido es la estructura
que lo hace imposible:

- El agente tendrá **identidad propia**, distinta de la de la API, creada por
  el módulo `iam` con `roles/viewer` y nada más.
- El módulo `iam` **rechaza** `roles/owner`, `roles/editor` y los roles que
  permiten escalar privilegios, con una precondición que corta el despliegue.
- `CO-IAM-01` bloquea esos mismos roles aunque alguien los declare fuera de un
  módulo aprobado.
- La aprobación vive en el **environment de GitHub**, fuera del alcance de
  cualquier credencial de GCP.
- El veredicto lo emite Conftest en el runner, no un servicio al que el agente
  pueda llamar.

Cuando el agente exista, la prueba consiste en darle sus credenciales reales e
intentar aprobar un pull request bloqueado.

## Lo que no se ha comprobado

| Qué | Por qué |
| --- | --- |
| `terraform plan` contra GCP | No hay proyecto |
| Los workflows ejecutándose en GitHub | Las ramas no están subidas |
| `terraform apply` y la prueba de destruir y recrear | Necesitan infraestructura real |
| Pruebas de rendimiento | Necesitan las instancias desplegadas |

Los fixtures están escritos a mano con la estructura que produce
`terraform show -json`. Cuando exista el proyecto hay que regenerarlos desde un
plan real y volver a correr la compuerta: si la estructura difiere en algo, es
ahí donde se verá.
