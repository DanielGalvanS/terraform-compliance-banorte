# Módulo `cloud_run`

Un servicio de Cloud Run. Se usa una vez por aplicación: la API, el frontend
y, más adelante, el agente para el drift.

## Decisiones

- **Cuenta de servicio obligatoria, y nunca la de Compute Engine.** Sin cuenta,
  Cloud Run usa la de Compute Engine por defecto, que trae **rol de editor
  sobre el proyecto entero**. Una validación rechaza esa cuenta por nombre.
- **Terraform crea el servicio; el despliegue cambia la imagen.** El servicio
  nace con `imagen_inicial` (por defecto, la imagen de ejemplo de Google) y
  `lifecycle.ignore_changes` deja la imagen en manos de `gcloud run deploy`.
  Si Terraform la vigilara, cada plan querría volver a la imagen inicial.
- **Cero instancias sin tráfico y CPU solo por petición.** Sin uso, el servicio
  no cobra CPU ni memoria.
- **Una instancia por defecto.** La API guarda sus datos en memoria mientras no
  tenga base: con dos instancias, cada una vería datos distintos.
- **Privado por defecto.** `publico = true` da `roles/run.invoker` a
  `allUsers` y nada más (decisión 20 de `docs/decisiones.md`).
- **Sin secretos en `variables_entorno`.** Lo que sea secreto va en Secret
  Manager.

## Uso

```hcl
module "api" {
  source = "../../modules/cloud_run"

  project_id      = var.project_id
  region          = var.region
  nombre          = "api-mdc-dev"
  cuenta_servicio = module.iam.cuentas["app-api"]
  etiquetas       = local.etiquetas
  publico         = true

  variables_entorno = {
    EVIDENCIA_BUCKET = module.logging.bucket
  }
}
```

## Pruebas

```bash
terraform -chdir=infra/modules/cloud_run init -backend=false
terraform -chdir=infra/modules/cloud_run test
```
