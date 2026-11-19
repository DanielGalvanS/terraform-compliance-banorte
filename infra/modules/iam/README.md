# Módulo `iam`

Cuentas de servicio con permisos acotados.

## Decisiones

- **Rechaza roles amplios.** `roles/owner`, `roles/editor` y los
  administradores de IAM se bloquean con una precondición que corta el
  despliegue antes de crear nada. Ninguna cuenta de esta plataforma los
  necesita, y concederlos haría imposible sostener el mínimo privilegio ante un
  auditor.
- **`google_project_iam_member`, nunca `iam_binding`.** El binding es
  autoritativo sobre el rol completo: aplicarlo borraría a cualquier otro
  miembro que lo tuviera, incluidos los agentes de servicio que GCP administra
  por su cuenta. Es uno de los errores más caros de revertir en IAM.
- **Una cuenta por responsabilidad.** El agente de IA lleva identidad propia y
  distinta de la API, porque solo así se puede demostrar que no tiene permiso
  para aplicar cambios (caso de prueba CP-17).

## Las cuentas de la plataforma

| Cuenta | Para qué | Permisos |
| --- | --- | --- |
| `app-api` | La API de cumplimiento | Lectura de la base y los secretos que use |
| `app-agente` | El agente de IA | Solo lectura; sin permiso de aplicar |
| `app-pruebas` | Instancias de prueba de rendimiento | Escritura de logs y métricas |

Las cuentas del pipeline (`ci-plan` y `ci-apply`) **no** las crea este módulo.
Tienen que existir antes del primer plan, así que las crea
`scripts/bootstrap/gcp_pipeline.sh` (ver `docs/decisiones.md`).

## Uso

```hcl
module "iam" {
  source = "../../modules/iam"

  project_id = var.project_id

  cuentas = {
    app-api = {
      descripcion = "API de cumplimiento en Cloud Run"
      roles       = ["roles/cloudsql.client", "roles/logging.logWriter"]
    }
    app-agente = {
      descripcion = "Agente de IA; solo lectura"
      roles       = ["roles/viewer"]
    }
  }
}
```
