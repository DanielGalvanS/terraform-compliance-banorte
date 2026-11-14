# Módulo `kms`

Llavero y llaves CMEK con rotación automática.

## Decisiones

- **El llavero tiene `prevent_destroy`.** GCP no permite borrar un llavero:
  destruirlo desde Terraform solo lo saca del estado, y el recurso sigue
  existiendo y facturando. Declararlo evita un `destroy` que daría una falsa
  sensación de limpieza.
- **Rotación de 90 días por defecto.** Es lo que cierra el hallazgo de llave
  sin rotar y lo que esperan los controles de gestión de llaves de NIST.
- **Permiso por llave, no por llavero.** Quien cifra los datos de una base no
  tiene por qué poder descifrar los de otra.
- **Las etiquetas se validan aquí.** La variable exige las cinco obligatorias,
  así que el error aparece en `terraform plan` y no hasta la compuerta.

## Uso

```hcl
module "kms" {
  source = "../../modules/kms"

  project_id = var.project_id
  region     = "us-central1"
  nombre     = "mdc-dev"

  llaves = {
    sql = {
      rotacion_dias = 90
      usuarios      = ["serviceAccount:${local.agente_sql}"]
    }
    secretos = {}
  }

  etiquetas = local.etiquetas_obligatorias
}
```
