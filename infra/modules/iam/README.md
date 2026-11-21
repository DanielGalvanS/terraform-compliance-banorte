# Módulo `iam`

Cuentas de servicio con permisos acotados.

## Decisiones

- **Rechaza roles amplios.** `roles/owner`, `roles/editor` y los
  administradores de IAM se bloquean con una precondición que corta el
  despliegue antes de crear nada. Ninguna cuenta de esta plataforma los
  necesita, y concederlos haría imposible sostener el mínimo privilegio ante un
  auditor.
- **Roles personalizados cuando ningún rol de Google es lo bastante chico.**
  `roles_personalizados` crea roles con la lista exacta de permisos. La misma
  precondición rechaza los permisos sueltos que hacen amplio a un rol
  (`*.setIamPolicy`, suplantar cuentas, crear o cambiar roles y otras rutas de
  escalamiento, ver `permisos_prohibidos`), porque si no un rol personalizado
  sería la forma de saltarse la regla anterior. También rechaza asignar un rol
  personalizado que el módulo no define. La lista es la misma que usa
  `CO-IAM-01`: si cambia una, cambia la otra.
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
| `app-agente` | El agente de IA | Solo lectura, más un rol personalizado que solo llama a Gemini en Vertex AI; sin permiso de aplicar |
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
      roles       = ["roles/viewer", "projects/mi-proyecto/roles/agenteLlamarModelo"]
    }
  }

  # Un rol personalizado se asigna por su ruta completa.
  roles_personalizados = {
    agenteLlamarModelo = {
      titulo      = "Agente: llamar al modelo"
      descripcion = "Solo generar respuestas con los modelos de Vertex AI"
      permisos    = ["aiplatform.endpoints.predict"]
    }
  }
}
```

## Pruebas

```bash
terraform -chdir=infra/modules/iam init -backend=false
terraform -chdir=infra/modules/iam test
```

Con el proveedor simulado: comprueban las asignaciones, que el rol del agente
lleve solo `aiplatform.endpoints.predict` y que la precondición rechace un rol
amplio, un rol personalizado con permisos que permiten escalar privilegios o
uno que el módulo no define.
